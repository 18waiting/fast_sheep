// M10 job runner (clean-room). Executes a registered job runner inside a RUNNING
// job with cooperative cancellation + monotonic progress reporting.
import type { JobRecord, JobRunContext } from "./types.js";
import type { JobFn } from "./job-registry.js";
import type { JobRepositoryPort } from "./ports/job-repository-port.js";
import type { Clock } from "./ports/clock.js";
import type { JobEventBus } from "./ports/event-bus.js";
import { JobCancellation } from "./job-cancellation.js";
import { JobProgress } from "./job-progress.js";

export interface ExecuteJobOptions {
  getRunner(type: JobRecord["type"]): JobFn | undefined;
  repository: JobRepositoryPort;
  clock: Clock;
  eventBus: JobEventBus;
}

/** Run a job body: mark RUNNING, build the JobRunContext, invoke the runner. */
export async function executeJob(job: JobRecord, options: ExecuteJobOptions): Promise<JobRecord> {
  const runner = options.getRunner(job.type);
  if (!runner) throw new Error("no runner for " + job.type);
  job.state = "RUNNING";
  options.repository.update(job);
  options.eventBus.emit("JobStateChanged", { job_id: job.job_id, state: "RUNNING", progress: job.progress, message: job.message });

  const cancellation = new JobCancellation(job.cancellation_token ?? undefined);
  const progress = new JobProgress();
  const ctx: JobRunContext = {
    jobId: job.job_id,
    type: job.type,
    signal: cancellation,
    checkCancelled: () => cancellation.isCancelled(),
    report: (p, message) => {
      const next = progress.report(p);
      job.progress = next;
      if (message) job.message = message;
      options.repository.update(job);
      options.eventBus.emit("JobProgress", { job_id: job.job_id, progress: next, message });
    },
  };
  const result = await runner(ctx);
  if (result !== undefined && result !== null) {
    job.result = typeof result === "string" ? result : JSON.stringify(result);
  }
  return job;
}
