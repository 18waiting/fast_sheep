// M11 import recovery smoke (clean-room). Fail after the Main phase -> restart the
// worker -> resume the SAME session id -> no duplicate knowledge rows.
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import {
  createSelection, planImport, ImportOrchestrator, SqliteImportSessionStore,
  PersistenceMainImportWriter, WorkerLegacyImportClient,
} from "../packages/legacy-import/dist/index.js";
import {
  SqliteShopRepository, SqliteSettingsRepository, SqliteProductRepository, SqlitePromptRepository,
  SqliteSkillRepository, SqliteTransferRuleRepository, SqliteForbiddenWordRepository, SqliteConversationRepository,
} from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const FIX = join(ROOT, "packages", "legacy-import", "tests", "fixtures", "full-valid");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m11-recov-"));
let worker, db;
const report = { scenario: "import recovery", failed_after: "main", resumed: null, knowledge_before_resume: 0, knowledge_after_resume: 0, duplicate: null, all_passed: false };
try {
  db = openDatabase(dataRoot);
  const conn = db.conn;
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  const sel = createSelection(FIX, collectFiles(FIX));
  const plan = await planImport(sel, {});
  const store = new SqliteImportSessionStore(conn);
  const makeWriter = () => new PersistenceMainImportWriter({
    shops: new SqliteShopRepository(conn), settings: new SqliteSettingsRepository(conn),
    products: new SqliteProductRepository(conn), prompts: new SqlitePromptRepository(conn),
    skills: new SqliteSkillRepository(conn), transferRules: new SqliteTransferRuleRepository(conn),
    forbiddenWords: new SqliteForbiddenWordRepository(conn), conversations: new SqliteConversationRepository(conn),
    conn,
  });
  const deps = {
    quickCheckOk: () => true, countRows: () => 0,
    countKnowledge: () => { try { return conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n; } catch { return 0; } },
    countCandidates: () => 0, ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true,
  };
  const ragRebuild = async () => { const r = await worker.request("rag.rebuild_index", { mode: "full" }); return r.ok === true; };

  // First attempt: the worker phase fails after Main wrote (simulated crash).
  const failingClient = {
    validateKnowledge: async () => ({ ok: true, errors: [], rows: 0 }),
    applyKnowledge: async () => { throw new Error("worker crashed after main phase"); },
    verifyKnowledge: async () => ({ ok: true, counts: {} }),
  };
  const failingOrch = new ImportOrchestrator({
    sessionStore: store, mainWriter: makeWriter(), workerClient: failingClient,
    backup: { backup: () => ({ backup_id: "bk-recovery", path: "" }) }, secretStore: { store: () => null },
    verificationDeps: deps, ragRebuild,
  });
  let sessionId;
  try {
    const first = await failingOrch.apply(plan, sel);
    sessionId = first.session.session_id;
    check("first attempt should fail at worker phase", false, "unexpectedly completed");
  } catch (e) {
    sessionId = store.listRecent()[0]?.session_id ?? "";
    const session = store.get(sessionId);
    check("session recoverable after Main phase failure", session?.state === "FAILED_RECOVERABLE", JSON.stringify(session));
    report.failed_after = "main";
  }

  const before = countKnowledge(conn);
  report.knowledge_before_resume = before;

  // Restart the worker (real process) and resume the SAME session id.
  await worker.stop();
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  const resumeOrch = new ImportOrchestrator({
    sessionStore: store, mainWriter: makeWriter(), workerClient: new WorkerLegacyImportClient(worker),
    backup: { backup: () => ({ backup_id: "bk-recovery", path: "" }) }, secretStore: { store: () => null },
    verificationDeps: deps, ragRebuild,
  });
  const resumed = await resumeOrch.apply(plan, sel, sessionId);
  report.resumed = resumed.session.state;
  check("resume completes", resumed.session.state === "COMPLETED", resumed.session.state);

  // Resume the SAME completed session again -> the idempotent writer must produce
  // zero additional knowledge rows (duplicate delta 0).
  const after = countKnowledge(conn);
  report.knowledge_after_resume = after;
  const resumedAgain = await resumeOrch.apply(plan, sel, sessionId);
  const afterAgain = countKnowledge(conn);
  report.duplicate = afterAgain - after;
  check("resume twice completes", resumedAgain.session.state === "COMPLETED");
  check("no duplicate knowledge after repeated resume", report.duplicate === 0, "delta=" + report.duplicate);

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m11-import-recovery-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M11 import recovery smoke FAILED"); process.exit(1); }
console.log("M11 import recovery smoke PASS.");

function collectFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(csv|json|md)$/.test(e.name)) out.push(p);
    }
  };
  walk(root);
  return out;
}

function countKnowledge(conn) {
  try { return conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n; } catch { return 0; }
}
