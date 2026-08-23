// M10 job-recovery smoke (clean-room).
// 1) A RUNNING non-idempotent job + worker crash -> no blind replay -> no duplicate mutation.
// 2) M9 crash-window idempotency preflight across a REAL worker restart: the same
//    feedback id reissued after restart yields exactly one logical knowledge effect.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteJobRepository, SqliteFeedbackRepository } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import { JobManager, JobRegistry, recoverAll } from "../packages/background-jobs/dist/index.js";
import { FeedbackService, PersistenceFeedbackRepository, WorkerKnowledgeFeedbackClient } from "../packages/feedback/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

// ---- 1) Job recovery: no blind replay of non-idempotent mutation jobs ----
{
  const rows = new Map();
  const repo = {
    create: (j) => rows.set(j.job_id, { ...j }),
    update: (j) => rows.set(j.job_id, { ...j }),
    get: (id) => rows.get(id) ?? null,
    list: () => [...rows.values()],
    listByState: (state) => [...rows.values()].filter((j) => j.state === state),
  };
  const registry = new JobRegistry();
  let mutationCalls = 0;
  registry.register("optimization", async () => { mutationCalls += 1; return { ok: true }; });
  const manager = new JobManager({ registry, repository: repo, jobIdFactory: () => "j-mut-1" });
  manager.create("optimization", {});
  // Simulate a crash mid-run: the mutation already happened but the job is still RUNNING.
  const job = repo.get("j-mut-1");
  job.state = "RUNNING";
  repo.update(job);
  const decisions = recoverAll(repo);
  const d = decisions.find((x) => x.job_id === "j-mut-1");
  check("running non-idempotent job marked FAILED", d?.state === "FAILED", JSON.stringify(d));
  check("automatic replay disabled", d?.automatic_replay === false);
  check("no duplicate mutation after recovery", mutationCalls === 0, "mutationCalls=" + mutationCalls);
  const report = {
    scenario: "job recovery",
    automatic_non_idempotent_replay: false,
    duplicate_mutation: mutationCalls > 0,
    recovery_state: d?.state,
    all_passed: d?.state === "FAILED" && d?.automatic_replay === false && mutationCalls === 0,
  };
  writeFileSync(join(ROOT, "reports", "m10-job-recovery-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  if (!report.all_passed) failed += 1;
}

// ---- 2) M9 crash-window idempotency preflight across a real worker restart ----
{
  const dataRoot = mkdtempSync(join(tmpdir(), "fw-m10-preflight-"));
  let worker;
  let conn;
  let preflight;
  try {
    ({ conn } = openDatabase(dataRoot));
    worker = new AIWorkerClient({
      spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
      env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
      startupTimeoutMs: 20000, requestTimeoutMs: 60000,
    });
    await worker.start();
    const feedbackRepo = new SqliteFeedbackRepository(conn);
    const service = new FeedbackService({
      repository: new PersistenceFeedbackRepository(feedbackRepo),
      knowledgeClient: new WorkerKnowledgeFeedbackClient(worker),
      recordIdFactory: () => "fr-preflight-1",
    });

    const first = await service.handle({ class: "MANUAL", trust: "HUMAN_CONFIRMED", conversationId: "c1", question: "崩溃窗口问题", reply: "崩溃窗口答案" });
    check("first apply APPLIED", first.effect_status === "APPLIED");

    // Simulate the crash window: Main wrote the record but died before marking APPLIED.
    feedbackRepo.updateEffectStatus("fr-preflight-1", "PENDING", { attempts: 0, lastError: null, appliedAt: null });

    // Restart the worker (real process restart).
    await worker.stop();
    worker = new AIWorkerClient({
      spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
      env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
      startupTimeoutMs: 20000, requestTimeoutMs: 60000,
    });
    await worker.start();

    // Reissue the same feedback id via the worker retry RPC.
    let retry;
    try {
      retry = await worker.request("feedback.retry", { record_id: "fr-preflight-1", conversation_id: "c1", class: "MANUAL", trust_level: "HUMAN_CONFIRMED", question: "崩溃窗口问题", answer: "崩溃窗口答案", product_id: "", entry: {}, created_at: "2026-08-16T00:00:00Z" });
    } catch (e) {
      console.error("retry error:", e && e.code, e && e.category, e && e.message);
      try { const h = await worker.request("system.health", {}); console.log("health:", JSON.stringify(h)); } catch (e2) { console.error("health error:", e2 && e2.message); }
      throw e;
    }
    check("retry after restart APPLIED", retry.applied === true, JSON.stringify(retry));

    const rows = conn.all("SELECT COUNT(*) AS n FROM knowledge_entries WHERE question = ? AND answer = ?", "崩溃窗口问题", "崩溃窗口答案");
    const n = rows[0]?.n ?? 0;
    check("exactly one logical knowledge effect after retry", n === 1, "rows=" + n);

    preflight = {
      scenario: "M9 crash-window idempotency preflight",
      worker_restart: true,
      same_feedback_id: true,
      knowledge_rows_after_retry: n,
      duplicate_effect: n > 1,
      durable_mechanism: "deterministic entry id + knowledge upsert (ON CONFLICT DO UPDATE) + Main feedback_records effect_status",
      result: n === 1 ? "PASS" : "FAIL",
    };
    if (n !== 1) failed += 1;
  } finally {
    await worker?.stop().catch(() => undefined);
    try { conn?.close(); } catch { /* ignore */ }
    rmSync(dataRoot, { recursive: true, force: true });
  }
  writeFileSync(join(ROOT, "reports", "m10-m9-idempotency-preflight-report.json"), JSON.stringify(preflight, null, 2) + "\n", "utf-8");
}

if (failed > 0) { console.error("M10 job recovery smoke FAILED"); process.exit(1); }
console.log("M10 job recovery smoke PASS.");
