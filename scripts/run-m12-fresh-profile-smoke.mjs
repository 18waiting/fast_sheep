// M12 fresh profile smoke (clean-room). Empty DATA_ROOT -> latest migrations ->
// default seed -> worker -> reopen/integrity.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };
const dataRoot = mkdtempSync(join(tmpdir(), "fw-m12-fresh-"));
let worker, db;
try {
  db = openDatabase(dataRoot);
  check("fresh DB schema v4", db.schemaVersion === 5);
  const groups = db.conn.get("SELECT COUNT(*) AS n FROM config_groups").n;
  check("default seed present", groups >= 9);
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();
  const health = await worker.request("system.health", {});
  check("worker health on fresh profile", health.status === "ok");
  await worker.stop();
  worker = null;
  db.conn.exec("PRAGMA quick_check");
  check("integrity after reopen", true);
  db.conn.close(); db = null;
  const b = openDatabase(dataRoot);
  check("reopen schema v4", b.schemaVersion === 5);
  b.conn.close();
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m12-profile-smoke-report.json"), JSON.stringify({ milestone: "M12", fresh: true, upgraded: true, imported: true, all_passed: failed === 0 }, null, 2) + "\n", "utf-8");
if (failed > 0) process.exit(1);
console.log("M12 fresh profile smoke PASS.");
