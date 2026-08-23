// M10 ReviewService (clean-room). Main schedules review jobs; the Worker runs
// review.propose / review.apply / review.restore (deletion proposal, triple-match
// delete, durable rollback, idempotent restore).
import type { WorkerJobClientPort } from "@fastwork/background-jobs";
import type { ReviewActionRequest } from "@fastwork/desktop-ipc";
import type { BackgroundJobService } from "./background-job-service.js";

export interface ReviewServiceOptions {
  jobs: BackgroundJobService;
  worker: WorkerJobClientPort;
  eventSink?: (channel: string, payload: unknown) => void;
}

export class ReviewService {
  private readonly jobs: BackgroundJobService;
  private readonly worker: WorkerJobClientPort;
  private readonly sink: (channel: string, payload: unknown) => void;
  private readonly active = new Map<string, Promise<unknown>>();

  constructor(options: ReviewServiceOptions) {
    this.jobs = options.jobs;
    this.worker = options.worker;
    this.sink = options.eventSink ?? (() => {});
    this.jobs.register("review", async (ctx) => {
      const request = this.jobs.requestFor(ctx.jobId);
      const action = String(request.action ?? "propose");
      const method = action === "apply" ? "review.apply" : action === "restore" ? "review.restore" : "review.propose";
      ctx.report(10, "review " + action + " started");
      const result = await this.worker.run(method, (request.request ?? {}) as Record<string, unknown>);
      ctx.report(100, "review " + action + " completed");
      this.jobs.forget(ctx.jobId);
      return result;
    });
  }

  action(request: ReviewActionRequest): { job_id: string } {
    const job = this.jobs.create("review", { ...request });
    void this.run(job.job_id);
    this.sink("review.changed", { event: "review.started", job_id: job.job_id, action: request.action });
    return { job_id: job.job_id };
  }

  async run(jobId: string): Promise<unknown> {
    const existing = this.active.get(jobId);
    if (existing) return existing;
    const p = this.jobs.run(jobId).then((record) => {
      this.sink("review.changed", { event: "review.finished", job_id: jobId, state: record.state });
      return record;
    });
    this.active.set(jobId, p);
    return p;
  }
}
