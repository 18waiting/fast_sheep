// M10 LearningService (clean-room). Main schedules the learning background job;
// the Worker executes learning.run (offline QA lifecycle). Node never writes
// knowledge — pending/candidate writes happen inside the Worker process.
import type { WorkerJobClientPort } from "@fastwork/background-jobs";
import type { LearningStartRequest } from "@fastwork/desktop-ipc";
import type { BackgroundJobService } from "./background-job-service.js";

export interface LearningServiceOptions {
  jobs: BackgroundJobService;
  worker: WorkerJobClientPort;
  eventSink?: (channel: string, payload: unknown) => void;
}

export class LearningService {
  private readonly jobs: BackgroundJobService;
  private readonly worker: WorkerJobClientPort;
  private readonly sink: (channel: string, payload: unknown) => void;
  private readonly active = new Map<string, Promise<unknown>>();

  constructor(options: LearningServiceOptions) {
    this.jobs = options.jobs;
    this.worker = options.worker;
    this.sink = options.eventSink ?? (() => {});
    this.jobs.register("learning", async (ctx) => {
      const request = this.jobs.requestFor(ctx.jobId);
      ctx.report(5, "learning started");
      const result = await this.worker.run("learning", request);
      ctx.report(100, "learning completed");
      this.jobs.forget(ctx.jobId);
      return result;
    });
  }

  start(request: LearningStartRequest): { job_id: string } {
    const job = this.jobs.create("learning", { ...request });
    void this.run(job.job_id);
    this.sink("learning.changed", { event: "learning.started", job_id: job.job_id });
    return { job_id: job.job_id };
  }

  /** Await a previously started job (deterministic tests / smoke probes). */
  async run(jobId: string): Promise<unknown> {
    const existing = this.active.get(jobId);
    if (existing) return existing;
    const p = this.jobs.run(jobId).then((record) => {
      this.sink("learning.changed", { event: "learning.finished", job_id: jobId, state: record.state });
      return record;
    });
    this.active.set(jobId, p);
    return p;
  }
}
