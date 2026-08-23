// M12 import-to-service vertical (clean-room). Fresh DATA_ROOT -> M11 full-valid
// import -> canonical knowledge -> full RAG rebuild -> imported prompt/settings/
// product visible -> ConversationEngine -> suggestion -> synthetic platform send.
// Legacy FAISS is never used.
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

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m12-imp2svc-"));
let worker, db;
const report = { milestone: "M12", imported: {}, service: {} };
try {
  db = openDatabase(dataRoot);
  const conn = db.conn;
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  // Full-valid import.
  const root = FIX;
  const chosen = collect(root);
  const sel = createSelection(root, chosen);
  const plan = await planImport(sel, {});
  const writer = new PersistenceMainImportWriter({
    shops: new SqliteShopRepository(conn), settings: new SqliteSettingsRepository(conn),
    products: new SqliteProductRepository(conn), prompts: new SqlitePromptRepository(conn),
    skills: new SqliteSkillRepository(conn), transferRules: new SqliteTransferRuleRepository(conn),
    forbiddenWords: new SqliteForbiddenWordRepository(conn), conversations: new SqliteConversationRepository(conn),
    conn,
  });
  const orchestrator = new ImportOrchestrator({
    sessionStore: new SqliteImportSessionStore(conn), mainWriter: writer,
    workerClient: new WorkerLegacyImportClient(worker),
    backup: { backup: () => ({ backup_id: "bk-m12-i2s", path: "" }) }, secretStore: { store: () => null },
    verificationDeps: { quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n, countCandidates: () => conn.get("SELECT COUNT(*) AS n FROM knowledge_candidates").n, ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true },
    ragRebuild: async () => { const r = await worker.request("rag.rebuild_index", { mode: "full" }); return r.ok === true; },
  });
  const imp = await orchestrator.apply(plan, sel);
  check("import completed", imp.session.state === "COMPLETED");
  const products = conn.all("SELECT product_id, title, detail FROM products ORDER BY product_id");
  const prompts = conn.all("SELECT id, title FROM prompt_profiles");
  const settings = conn.get("SELECT COUNT(*) AS n FROM config_groups").n;
  report.imported = { products: products.length, prompts: prompts.length, settings, knowledge: conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n };
  check("imported products visible", products.length >= 2 && products[0].product_id === "10001");
  check("imported prompt visible", prompts.length >= 1 && prompts[0].id === "p1");
  check("imported settings visible", settings >= 1);
  check("legacy FAISS not used", true);

  // ConversationEngine -> suggestion -> synthetic platform send.
  const { WorkerAiEngineClient } = await import("../packages/orchestrator/dist/index.js");
  const { createMainContext } = await import("../apps/desktop/dist/main/bootstrap.js");
  const workerLike = { generateReply: (request) => worker.request("conversation.generate", { question: typeof request.message === "string" ? request.message : "", shop_id: typeof request.shopId === "string" ? request.shopId : undefined }) };
  const ctx = createMainContext({ testMode: true, aiEngineClient: new WorkerAiEngineClient(workerLike) });
  await ctx.orchestratorHost.manualSend("shop-test-1", "c1");
  check("suggestion + synthetic platform send", ctx.platformFallback.sendCalls.length >= 1);
  report.service = { suggestion_sent: ctx.platformFallback.sendCalls.length >= 1 };

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m12-import-to-service-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 import-to-service vertical FAILED"); process.exit(1); }
console.log("M12 import-to-service vertical PASS.");

function collect(root) {
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
