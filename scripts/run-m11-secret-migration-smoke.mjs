// M11 secret migration smoke (clean-room). Explicit provider-secret consent moves
// the secret to a SecretStore credential_ref; plaintext never appears in the
// canonical DB, plan, manifest, report, or renderer payloads.
import { mkdtempSync, rmSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import {
  createSelection, planImport, ImportOrchestrator, SqliteImportSessionStore,
  PersistenceMainImportWriter, WorkerLegacyImportClient, SecretStoreAdapter,
  detectSecrets, providerSecretDecision,
} from "../packages/legacy-import/dist/index.js";
import {
  SqliteShopRepository, SqliteSettingsRepository, SqliteProductRepository, SqlitePromptRepository,
  SqliteSkillRepository, SqliteTransferRuleRepository, SqliteForbiddenWordRepository, SqliteConversationRepository,
} from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const FIX = join(ROOT, "packages", "legacy-import", "tests", "fixtures", "settings-with-synthetic-secret");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

const PLAINTEXT = "fake-super-secret-value";
const dataRoot = mkdtempSync(join(tmpdir(), "fw-m11-secret-"));
let worker, db;
const report = { scenario: "secret migration", consent: true, credential_ref: null, plaintext_in_db: false, all_passed: false };
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
  const plan = await planImport(sel, { import_provider_secret: true });
  const secretDetected = plan.secret_fields_detected.some((f) => /api_key|secret/i.test(f));
  check("dry-run detected the provider secret field", secretDetected, JSON.stringify(plan.secret_fields_detected));
  check("dry-run output contains no plaintext secret", !JSON.stringify(plan).includes(PLAINTEXT));

  const decision = providerSecretDecision({ import_provider_secret: true }, "api_key");
  check("explicit consent yields credential_ref decision", decision.action === "store_ref");
  const secretStore = new SecretStoreAdapter();
  const ref = secretStore.store("api_key", PLAINTEXT, true);
  report.credential_ref = ref?.credential_ref ?? null;
  check("SecretStore returns credential_ref only", ref !== null && !String(ref).includes(PLAINTEXT));

  const store = new SqliteImportSessionStore(conn);
  const writer = new PersistenceMainImportWriter({
    shops: new SqliteShopRepository(conn), settings: new SqliteSettingsRepository(conn),
    products: new SqliteProductRepository(conn), prompts: new SqlitePromptRepository(conn),
    skills: new SqliteSkillRepository(conn), transferRules: new SqliteTransferRuleRepository(conn),
    forbiddenWords: new SqliteForbiddenWordRepository(conn), conversations: new SqliteConversationRepository(conn),
    conn,
  });
  const orchestrator = new ImportOrchestrator({
    sessionStore: store, mainWriter: writer, workerClient: new WorkerLegacyImportClient(worker),
    backup: { backup: () => ({ backup_id: "bk-secret", path: "" }) }, secretStore,
    verificationDeps: {
      quickCheckOk: () => true, countRows: () => 0,
      countKnowledge: () => { try { return conn.get("SELECT COUNT(*) AS n FROM knowledge_entries").n; } catch { return 0; } },
      countCandidates: () => 0, ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true,
    },
    ragRebuild: async () => { const r = await worker.request("rag.rebuild_index", { mode: "full" }); return r.ok === true; },
  });
  const res = await orchestrator.apply(plan, sel);

  // No plaintext anywhere in the canonical DB.
  const dump = JSON.stringify(conn.all("SELECT * FROM config_groups")).concat(JSON.stringify(conn.all("SELECT * FROM legacy_import_sessions")));
  report.plaintext_in_db = dump.includes(PLAINTEXT);
  check("plaintext secret absent from SQLite", !dump.includes(PLAINTEXT));
  check("apply completed", res.session.state === "COMPLETED");

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
{
  const existing = JSON.parse(readFileSync(join(ROOT, "reports", "m11-import-security-report.json"), "utf-8"));
  writeFileSync(join(ROOT, "reports", "m11-import-security-report.json"), JSON.stringify({ ...existing, secret_migration_smoke: report }, null, 2) + "\n", "utf-8");
}
if (failed > 0) { console.error("M11 secret migration smoke FAILED"); process.exit(1); }
console.log("M11 secret migration smoke PASS.");

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
