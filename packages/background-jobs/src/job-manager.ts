// M10 job manager (clean-room). Owns job lifecycle + recovery boundaries.
import type { JobRecord, JobRunContext, JobState, JobType } from "./types.js";
import { JobCancellation } from "./job-cancellation.js";
import { JobProgress } from "./job-progress.js";
import type { JobRegistry } from "./job-registry.js";
import { executeJob } from "./job-runner.js";
import type { JobRepositoryPort } from "./ports/job-repository-port.js";
import { SystemClock, type Clock } from "./ports/clock.js";
import { NoopJobEventBus, type JobEventBus } from "./ports/event-bus.js";
import { JobError, JOB_ERROR_CODES } from "./errors.js";

export interface JobManagerOptions {
  registry: JobRegistry;
  repository: JobRepositoryPort;
  clock?: Clock;
  eventBus?: JobEventBus;
  jobIdFactory?: () => string;
}

export class JobManager {
  private readonly registry: JobRegistry;
  private readonly repository: JobRepositoryPort;
  private readonly clock: Clock;
  private readonly eventBus: JobEventBus;
  private readonly jobIdFactory: () => string;

  constructor(options: JobManagerOptions) {
    this.registry = options.registry;
    this.repository = options.repository;
    this.clock = options.clock ?? new SystemClock();
    this.eventBus = options.eventBus ?? new NoopJobEventBus();
    this.jobIdFactory = options.jobIdFactory ?? (() => "job-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8));
  }

  create(type: JobType, request: Record<string, unknown>, options?: { idempotent?: boolean; cancellationToken?: string }): JobRecord {
    const jobId = this.jobIdFactory();
    const job: JobRecord = {
      job_id: jobId, type, state: "QUEUED", progress: 0, message: "",
      started_at: new Date(this.clock.now()).toISOString(),
      cancellation_token: options?.cancellationToken ?? null,
      result: options?.idempotent ? JSON.stringify({ idempotent: true }) : null,
    };
    this.repository.create(job);
    this.eventBus.emit("JobStateChanged", { job_id: jobId, state: "QUEUED", progress: 0 });
    void request;
    return job;
  }

  get(jobId: string): JobRecord | null { return this.repository.get(jobId); }
  list(type?: string, limit?: number): JobRecord[] { return this.repository.list(type, limit); }

  async run(jobId: string): Promise<JobRecord> {
    const job = this.repository.get(jobId);
    if (!job) throw new JobError(JOB_ERROR_CODES.NOT_FOUND, "unknown job");
    if (!this.registry.get(job.type)) throw new JobError(JOB_ERROR_CODES.NOT_FOUND, "no runner for " + job.type);
    const cancellation = new JobCancellation(job.cancellation_token ?? undefined);
    const progress = new JobProgress();
    const ctx: JobRunContext = {
      jobId, type: job.type, signal: cancellation,
      checkCancelled: () => cancellation.isCancelled(),
      report: (p, message) => {
        const next = progress.report(p);
        job.progress = next;
        if (message) job.message = message;
        this.repository.update(job);
        this.eventBus.emit("JobProgress", { job_id: jobId, progress: next, message });
      },
    };
    try {
      const result = await executeJob(job, {
        getRunner: (t) => this.registry.get(t),
        repository: this.repository,
        clock: this.clock,
        eventBus: this.eventBus,
      });
      job.result = result && result.result ? result.result : job.result;
      this.complete(job);
      void ctx;
    } catch (e) {
      if (cancellation.isCancelled()) this.cancel(jobId);
      else this.fail(job, e instanceof Error ? e.message : String(e));
    }
    return this.repository.get(jobId)!;
  }

  cancel(jobId: string): JobRecord {
    const job = this.repository.get(jobId);
    if (!job) throw new JobError(JOB_ERROR_CODES.NOT_FOUND, "unknown job");
    if (job.state === "COMPLETED" || job.state === "CANCELLED") throw new JobError(JOB_ERROR_CODES.ALREADY_CANCELLED, "job finished");
    this.transition(job, "CANCELLING");
    job.finished_at = new Date(this.clock.now()).toISOString();
    this.transition(job, "CANCELLED");
    return job;
  }

  private transition(job: JobRecord, state: JobState): void {
    job.state = state;
    if (state === "COMPLETED" || state === "FAILED" || state === "CANCELLED") job.finished_at = new Date(this.clock.now()).toISOString();
    this.repository.update(job);
    this.eventBus.emit("JobStateChanged", { job_id: job.job_id, state, progress: job.progress, message: job.message });
  }

  private complete(job: JobRecord): void { this.transition(job, "COMPLETED"); }
  private fail(job: JobRecord, error: string): void {
    job.error = error.slice(0, 500);
    this.transition(job, "FAILED");
  }
}
