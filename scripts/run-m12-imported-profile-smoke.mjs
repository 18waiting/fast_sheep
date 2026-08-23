// M12 imported profile smoke (clean-room). M11 synthetic imported DATA_ROOT ->
// reopen -> stores + RAG usable.
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteShopRepository, SqliteSettingsRepository, SqliteProductRepository, SqlitePromptRepository, SqliteSkillRepository, SqliteTransferRuleRepository, SqliteForbiddenWordRepository, SqliteConversationRepository } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import { createSelection, planImport, ImportOrchestrator, SqliteImportSessionStore, PersistenceMainImportWriter, WorkerLegacyImportClient } from "../packages/legacy-import/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const FIX = join(ROOT, "packages", "legacy-import", "tests", "fixtures", "full-valid");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };
const dataRoot = mkdtempSync(join(tmpdir(), "fw-m12-imported-"));
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
  const chosen = (() => { const out = []; const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(csv|json|md)$/.test(e.name)) out.push(p); } }; walk(FIX); return out; })();
  const sel = createSelection(FIX, chosen);
  const plan = await planImport(sel, {});
  const writer = new PersistenceMainImportWriter({
    shops: new SqliteShopRepository(conn), settings: new SqliteSettingsRepository(conn), products: new SqliteProductRepository(conn),
    prompts: new SqlitePromptRepository(conn), skills: new SqliteSkillRepository(conn), transferRules: new SqliteTransferRuleRepository(conn),
    forbiddenWords: new SqliteForbiddenWordRepository(conn), conversations: new SqliteConversationRepository(conn), conn,
  });
  const orch = new ImportOrchestrator({
    sessionStore: new SqliteImportSessionStore(conn), mainWriter: writer, workerClient: new WorkerLegacyImportClient(worker),
    backup: { backup: () => ({ backup_id: "bk-imported", path: "" }) }, secretStore: { store: () => null },
    verificationDeps: { quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n, countCandidates: () => conn.get("SELECT COUNT(*) AS n FROM knowledge_candidates").n, ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true },
    ragRebuild: async () => { const r = await worker.request("rag.rebuild_index", { mode: "full" }); return r.ok === true; },
  });
  await orch.apply(plan, sel);
  const rag = await worker.request("rag.index_status", {});
  check("imported RAG ready", rag.ready === true);
  await worker.stop(); worker = null;
  db.conn.close(); db = null;
  const b = openDatabase(dataRoot);
  check("imported profile reopen v4", b.schemaVersion === 4);
  const products = new SqliteProductRepository(b.conn).list();
  check("imported products usable after reopen", products.length >= 2);
  b.conn.close();
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
if (failed > 0) process.exit(1);
console.log("M12 imported profile smoke PASS.");
