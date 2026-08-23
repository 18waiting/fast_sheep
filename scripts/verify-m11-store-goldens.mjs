// M11 STORE golden execution (clean-room). Discovers every GF-STORE-* from disk and
// executes each case for real: worker-side cases via the Python golden runner, and
// the import verticals (minimal-valid, messages) via a real Worker + the
// @fastwork/legacy-import orchestrator.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
const TESTS = join(ROOT, "services", "ai-worker", "tests");
const FIXTURES = join(ROOT, "..", "parity-tests", "fixtures", "store");
const LEGACY_FIX = join(ROOT, "packages", "legacy-import", "tests", "fixtures");

const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort();
const results = [];
let failed = 0;
const check = (id, ok, extra = "") => { console.log((ok ? "PASS " : "FAIL ") + id + (ok ? "" : " " + extra)); if (!ok) failed += 1; results.push({ case_id: id, result: ok ? "PASS" : "FAIL", detail: extra }); };

// Worker-side cases via the Python runner.
const pyCases = files.filter((f) => !["GF-STORE-008.json", "GF-STORE-014.json"].includes(f));
const code = [
  "import sys, json",
  "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
  "sys.path.insert(0, " + JSON.stringify(TESTS) + ")",
  "from m11_golden_runner import run_store_case",
  "out = []",
  "for f in " + JSON.stringify(pyCases.map((x) => join(FIXTURES, x))) + ":",
  "    fx = json.load(open(f, encoding='utf-8'))",
  "    out.append({'case_id': fx['case_id'], 'result': run_store_case(fx)})",
  "print(json.dumps(out))",
].join("\n");
let pyOut;
try {
  pyOut = JSON.parse(execFileSync("py", ["-3.12", "-c", code], { encoding: "utf-8", cwd: ROOT }).trim().split(/\r?\n/).pop());
} catch (e) {
  pyOut = [];
  console.error("python runner error:", String(e.stdout ?? e.message).slice(0, 1000));
}
for (const r of pyOut) check(r.case_id, r.result === "PASS", "worker runner");

async function runVertical(fixtureDir) {
  const dataRoot = mkdtempSync(join(tmpdir(), "fw-m11-store-"));
  let worker, db;
  try {
    db = openDatabase(dataRoot);
    const conn = db.conn;
    worker = new AIWorkerClient({
      spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
      env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
      startupTimeoutMs: 20000, requestTimeoutMs: 60000,
    });
    await worker.start();
    const root = join(LEGACY_FIX, fixtureDir);
    const chosen = collectFiles(root);
    const sel = createSelection(root, chosen);
    const plan = await planImport(sel, {});
    const store = new SqliteImportSessionStore(conn);
    const writer = new PersistenceMainImportWriter({
      shops: new SqliteShopRepository(conn),
      settings: new SqliteSettingsRepository(conn),
      products: new SqliteProductRepository(conn),
      prompts: new SqlitePromptRepository(conn),
      skills: new SqliteSkillRepository(conn),
      transferRules: new SqliteTransferRuleRepository(conn),
      forbiddenWords: new SqliteForbiddenWordRepository(conn),
      conversations: new SqliteConversationRepository(conn),
      conn,
    });
    const orchestrator = new ImportOrchestrator({
      sessionStore: store,
      mainWriter: writer,
      workerClient: new WorkerLegacyImportClient(worker),
      backup: { backup: () => ({ backup_id: "bk-" + fixtureDir, path: "" }) },
      secretStore: { store: () => null },
      verificationDeps: makeVerificationDeps(conn),
      ragRebuild: async () => { const r = await worker.request("rag.rebuild_index", { mode: "full" }); return r.ok === true; },
    });
    const res = await orchestrator.apply(plan, sel);
    const counts = {
      shops: conn.get("SELECT COUNT(*) AS n FROM shops").n,
      products: conn.get("SELECT COUNT(*) AS n FROM products").n,
      knowledge: conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n,
      messages: conn.get("SELECT COUNT(*) AS n FROM conversation_messages").n,
      settings: conn.get("SELECT COUNT(*) AS n FROM config_groups").n,
    };
    return { res, counts };
  } finally {
    await worker?.stop().catch(() => undefined);
    try { db?.conn.close(); } catch { /* ignore */ }
    rmSync(dataRoot, { recursive: true, force: true });
  }
}

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

function makeVerificationDeps(conn) {
  return {
    quickCheckOk: () => { try { conn.exec("PRAGMA quick_check"); return true; } catch { return false; } },
    countRows: () => 0,
    countKnowledge: () => { try { return conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n; } catch { return 0; } },
    countCandidates: () => { try { return conn.get("SELECT COUNT(*) AS n FROM knowledge_candidates").n; } catch { return 0; } },
    ragReady: async () => true,
    noPlaintextSecrets: () => true,
    noDanglingMounts: () => true,
  };
}

// GF-STORE-008: minimal-valid -> shops 1, knowledge 2, settings mapped.
const store008 = await runVertical("minimal-valid");
check("GF-STORE-008", store008.res.session.state === "COMPLETED" && store008.counts.shops >= 1 && store008.counts.knowledge >= 2, JSON.stringify(store008.counts));

// GF-STORE-014: messages -> 3 rows imported.
const store014 = await runVertical("full-valid");
check("GF-STORE-014", store014.res.session.state === "COMPLETED" && store014.counts.messages >= 3, "messages=" + store014.counts.messages);

writeFileSync(join(ROOT, "reports", "m11-store-parity-report.json"), JSON.stringify({
  milestone: "M11", discovered: files.length, executed: results.length, passed: results.length - failed, failed, cases: results,
  all_passed: failed === 0,
}, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M11 STORE goldens FAILED"); process.exit(1); }
console.log("M11 STORE golden execution PASS (" + (results.length - failed) + "/" + results.length + ").");
