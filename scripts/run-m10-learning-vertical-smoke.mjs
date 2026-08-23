// M10 learning vertical smoke (clean-room). Synthetic transcript -> BackgroundJobManager
// -> real worker learning.run -> pending_knowledge writes -> index signal -> job COMPLETED.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteJobRepository } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import { WorkerJobClient } from "../packages/background-jobs/dist/index.js";
import { BackgroundJobService } from "../apps/desktop/dist/main/services/background-job-service.js";
import { LearningService } from "../apps/desktop/dist/main/services/learning-service.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m10-learn-"));
let worker;
let db;
let conn;
const report = { scenario: "learning vertical", worker: "real", job_state: null, pending_rows: 0, index_signal: null, all_passed: false };
try {
  db = openDatabase(dataRoot);
  conn = db.conn;
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  const jobRepo = new SqliteJobRepository(conn);
  const jobs = new BackgroundJobService({ jobRepository: jobRepo });
  const learning = new LearningService({ jobs, worker: new WorkerJobClient(worker) });

  const chat = "===商品id10001===\n[买家]这个多少钱\n[客服]99元\n[买家]有XL吗\n[客服]有的";
  const started = learning.start({ import_source: "synthetic_chat.txt", chat });
  const job = await learning.run(started.job_id);
  report.job_state = job.state;
  check("learning job COMPLETED", job.state === "COMPLETED", JSON.stringify(job));

  const pending = conn.get("SELECT COUNT(*) AS n FROM pending_knowledge");
  report.pending_rows = pending.n;
  check("worker wrote pending_knowledge rows", pending.n >= 1, "rows=" + pending.n);

  const result = JSON.parse(job.result ?? "{}");
  report.index_signal = result.index_signal ?? null;
  check("index signal present", Boolean(result.index_signal));
  check("learning progress 100", job.progress === 100);

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { conn?.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m10-learning-effect-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M10 learning vertical smoke FAILED"); process.exit(1); }
console.log("M10 learning vertical smoke PASS.");
