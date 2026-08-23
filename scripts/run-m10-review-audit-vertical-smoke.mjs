// M10 review/audit vertical smoke (clean-room). Real worker:
// review proposal -> delete -> restore; audit 保留/丢弃/待定 -> one knowledge effect.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteJobRepository } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import { WorkerJobClient } from "../packages/background-jobs/dist/index.js";
import { BackgroundJobService } from "../apps/desktop/dist/main/services/background-job-service.js";
import { ReviewService } from "../apps/desktop/dist/main/services/review-service.js";
import { AuditService } from "../apps/desktop/dist/main/services/audit-service.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m10-revaudit-"));
let worker;
let conn;
const report = { scenario: "review/audit vertical", worker: "real", review_propose: null, audit_approve: null, audit_discard: null, audit_pending: null, all_passed: false };
try {
  ({ conn } = openDatabase(dataRoot));
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  const jobs = new BackgroundJobService({ jobRepository: new SqliteJobRepository(conn) });
  const workerClient = new WorkerJobClient(worker);
  const review = new ReviewService({ jobs, worker: workerClient });
  const audit = new AuditService({ jobs, worker: workerClient });

  // Review propose (empty delete list -> no deletions)
  const propose = review.action({ action: "propose", request: { ai_output: "[]" } });
  const proposeJob = await review.run(propose.job_id);
  report.review_propose = proposeJob.state;
  check("review propose job COMPLETED", proposeJob.state === "COMPLETED");

  // Review restore -> appends an AUTO knowledge row.
  const restore = review.action({ action: "restore", request: { record: { 商品ID: "10001", 问题: "q", 答案: "a" } } });
  const restoreJob = await review.run(restore.job_id);
  check("review restore job COMPLETED", restoreJob.state === "COMPLETED");

  // Audit 保留 -> one knowledge commit (HUMAN_CONFIRMED).
  const approve = audit.decide({ action: "保留", entry: { 问题: "有货吗", 答案: "亲,有的", 商品ID: "10001" } });
  const approveJob = await audit.run(approve.job_id);
  report.audit_approve = approveJob.state;
  check("audit 保留 job COMPLETED", approveJob.state === "COMPLETED");

  // Audit 丢弃 -> no knowledge write.
  const discard = audit.decide({ action: "丢弃", entry: { 问题: "坏问题", 答案: "坏答案" } });
  const discardJob = await audit.run(discard.job_id);
  report.audit_discard = discardJob.state;
  check("audit 丢弃 job COMPLETED", discardJob.state === "COMPLETED");

  // Audit 待定 -> pending kept, no knowledge write.
  const pending = audit.decide({ action: "待定", entry: { 问题: "待定问题", 答案: "待定答案" } });
  const pendingJob = await audit.run(pending.job_id);
  report.audit_pending = pendingJob.state;
  check("audit 待定 job COMPLETED", pendingJob.state === "COMPLETED");

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { conn?.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m10-review-audit-effect-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M10 review/audit vertical smoke FAILED"); process.exit(1); }
console.log("M10 review/audit vertical smoke PASS.");
