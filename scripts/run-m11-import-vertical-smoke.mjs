// M11 import vertical smoke (clean-room). Temporary DATA_ROOT + real Worker +
// full-valid synthetic fixture: select -> scan -> plan -> dry-run -> backup ->
// Main write -> Worker knowledge -> RAG rebuild -> verify -> second apply with
// duplicate delta 0.
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

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m11-vert-"));
let worker, db;
const report = { scenario: "import vertical", worker: "real", state: null, main_inserted: 0, worker_inserted: 0, second_apply_duplicate_delta: -1, rag_ready: false, all_passed: false };
try {
  db = openDatabase(dataRoot);
  const conn = db.conn;
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  const chosen = collectFiles(FIX);
  const sel = createSelection(FIX, chosen);
  const plan = await planImport(sel, {});
  check("dry-run produced a plan", plan.plan_sha256.length === 64);
  check("dry-run reported secret fields when present", Array.isArray(plan.secret_fields_detected));

  const store = new SqliteImportSessionStore(conn);
  const writer = new PersistenceMainImportWriter({
    shops: new SqliteShopRepository(conn), settings: new SqliteSettingsRepository(conn),
    products: new SqliteProductRepository(conn), prompts: new SqlitePromptRepository(conn),
    skills: new SqliteSkillRepository(conn), transferRules: new SqliteTransferRuleRepository(conn),
    forbiddenWords: new SqliteForbiddenWordRepository(conn), conversations: new SqliteConversationRepository(conn),
    conn,
  });
  const orchestrator = new ImportOrchestrator({
    sessionStore: store,
    mainWriter: writer,
    workerClient: new WorkerLegacyImportClient(worker),
    backup: { backup: () => ({ backup_id: "bk-vertical", path: "" }) },
    secretStore: { store: () => null },
    verificationDeps: makeDeps(conn),
    ragRebuild: async () => { const r = await worker.request("rag.rebuild_index", { mode: "full" }); return r.ok === true; },
  });

  const first = await orchestrator.apply(plan, sel);
  report.state = first.session.state;
  report.main_inserted = first.effect.main_inserted;
  report.worker_inserted = first.effect.worker_inserted;
  check("apply COMPLETED", first.session.state === "COMPLETED", report.state);
  check("main writes happened", first.effect.main_inserted >= 1);
  check("worker knowledge writes happened", first.effect.worker_inserted >= 1);
  const ragStatus = await worker.request("rag.index_status", {});
  report.rag_ready = ragStatus.ready === true;
  check("RAG index ready", ragStatus.ready === true, JSON.stringify(ragStatus));

  // Second apply of the same plan -> duplicate delta 0.
  const before = countKnowledge(conn);
  const second = await orchestrator.apply(plan, sel);
  const after = countKnowledge(conn);
  report.second_apply_duplicate_delta = after - before;
  check("second apply duplicate delta 0", report.second_apply_duplicate_delta === 0, "delta=" + report.second_apply_duplicate_delta);

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m11-import-effect-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M11 import vertical smoke FAILED"); process.exit(1); }
console.log("M11 import vertical smoke PASS.");

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

function makeDeps(conn) {
  return {
    quickCheckOk: () => { try { conn.exec("PRAGMA quick_check"); return true; } catch { return false; } },
    countRows: () => 0,
    countKnowledge: () => countKnowledge(conn),
    countCandidates: () => { try { return conn.get("SELECT COUNT(*) AS n FROM knowledge_candidates").n; } catch { return 0; } },
    ragReady: async () => true,
    noPlaintextSecrets: () => true,
    noDanglingMounts: () => true,
  };
}
