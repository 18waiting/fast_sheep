// M10 desktop ProductOptimizationService (clean-room). Worker generates the
// proposal only; Main applies the product mutation (guards -> cooldown -> durable
// backup -> atomic update) via @fastwork/product-optimization. Worker product
// writes = 0.
import type { WorkerJobClientPort } from "@fastwork/background-jobs";
import { ProductOptimizationService as PackageProductOptimizationService, type ProductRepositoryPort, type OptimizationWorkerClientPort, type ApplyResult } from "@fastwork/product-optimization";
import type { OptimizationActionRequest } from "@fastwork/desktop-ipc";
import type { BackgroundJobService } from "./background-job-service.js";

export interface DesktopProductOptimizationServiceOptions {
  jobs: BackgroundJobService;
  /** Worker RPC client used by the job runner (WorkerJobClient). */
  workerJobClient: WorkerJobClientPort;
  /** Optimization worker client (worker proposes only). */
  optimizationWorker: OptimizationWorkerClientPort;
  /** Main-owned product repository (single writer for products). */
  productRepository: ProductRepositoryPort;
  eventSink?: (channel: string, payload: unknown) => void;
  cooldownSeconds?: number;
  purgeSeconds?: number;
  dirtyLengthLimit?: number;
}

export class DesktopProductOptimizationService {
  private readonly jobs: BackgroundJobService;
  private readonly sink: (channel: string, payload: unknown) => void;
  private readonly applier: PackageProductOptimizationService;
  private readonly active = new Map<string, Promise<unknown>>();

  constructor(options: DesktopProductOptimizationServiceOptions) {
    this.jobs = options.jobs;
    this.sink = options.eventSink ?? (() => {});
    this.applier = new PackageProductOptimizationService({
      repository: options.productRepository,
      workerClient: options.optimizationWorker,
      cooldownSeconds: options.cooldownSeconds,
      purgeSeconds: options.purgeSeconds,
      dirtyLengthLimit: options.dirtyLengthLimit,
      eventBus: { emit: (event, payload) => this.sink("optimization.changed", { event, payload }) },
    });
    this.jobs.register("optimization", async (ctx) => {
      const request = this.jobs.requestFor(ctx.jobId);
      const action = String(request.action ?? "propose");
      ctx.report(10, "optimization " + action + " started");
      const result = action === "apply"
        ? await this.applyProposal((request.request ?? {}) as Record<string, unknown>)
        : await this.proposeAndApply((request.request ?? {}) as Record<string, unknown>);
      ctx.report(100, "optimization " + action + " completed");
      this.jobs.forget(ctx.jobId);
      return result;
    });
  }

  action(request: OptimizationActionRequest): { job_id: string } {
    const job = this.jobs.create("optimization", { ...request });
    void this.run(job.job_id);
    this.sink("optimization.changed", { event: "optimization.started", job_id: job.job_id, action: request.action });
    return { job_id: job.job_id };
  }

  async run(jobId: string): Promise<unknown> {
    const existing = this.active.get(jobId);
    if (existing) return existing;
    const p = this.jobs.run(jobId).then((record) => {
      this.sink("optimization.changed", { event: "optimization.finished", job_id: jobId, state: record.state });
      return record;
    });
    this.active.set(jobId, p);
    return p;
  }

  /** Worker propose -> Main guard/cooldown/backup/atomic apply. */
  private async proposeAndApply(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    const productId = String(request.product_id ?? "");
    const res = await this.applier.propose(productId);
    const result = await this.applier.apply(res, { backup: request.backup !== false });
    return this.toResult(result, res.detail);
  }

  /** Manual apply with an existing proposal payload. */
  private async applyProposal(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    const proposal = (request.proposal ?? request) as { product_id?: string; detail?: string };
    const result = await this.applier.apply(
      { product_id: String(proposal.product_id ?? ""), detail: String(proposal.detail ?? "") },
      { backup: request.backup !== false },
    );
    return this.toResult(result, String(proposal.detail ?? ""));
  }

  private toResult(result: ApplyResult, detail: string): Record<string, unknown> {
    return { applied: result.applied, reason: result.reason ?? null, backup_id: result.backup_id ?? null, detail_length: detail.length };
  }
}
