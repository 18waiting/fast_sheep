// M10 AuditService (clean-room). Main schedules audit jobs; the Worker runs
// audit.decide (保留/丢弃/待定 over learned candidates). Node writes no candidates.
import type { WorkerJobClientPort } from "@fastwork/background-jobs";
import type { AuditActionRequest } from "@fastwork/desktop-ipc";
import type { BackgroundJobService } from "./background-job-service.js";

export interface AuditServiceOptions {
  jobs: BackgroundJobService;
  worker: WorkerJobClientPort;
  eventSink?: (channel: string, payload: unknown) => void;
}

export class AuditService {
  private readonly jobs: BackgroundJobService;
  private readonly worker: WorkerJobClientPort;
  private readonly sink: (channel: string, payload: unknown) => void;
  private readonly active = new Map<string, Promise<unknown>>();

  constructor(options: AuditServiceOptions) {
    this.jobs = options.jobs;
    this.worker = options.worker;
    this.sink = options.eventSink ?? (() => {});
    this.jobs.register("audit", async (ctx) => {
      const request = this.jobs.requestFor(ctx.jobId);
      ctx.report(10, "audit decide started");
      const result = await this.worker.run("audit.decide", { action: request.action, entry: request.entry ?? {} });
      ctx.report(100, "audit decide completed");
      this.jobs.forget(ctx.jobId);
      return result;
    });
  }

  decide(request: AuditActionRequest): { job_id: string } {
    const job = this.jobs.create("audit", { ...request });
    void this.run(job.job_id);
    this.sink("audit.changed", { event: "audit.started", job_id: job.job_id, action: request.action });
    return { job_id: job.job_id };
  }

  async run(jobId: string): Promise<unknown> {
    const existing = this.active.get(jobId);
    if (existing) return existing;
    const p = this.jobs.run(jobId).then((record) => {
      this.sink("audit.changed", { event: "audit.finished", job_id: jobId, state: record.state });
      return record;
    });
    this.active.set(jobId, p);
    return p;
  }
}
