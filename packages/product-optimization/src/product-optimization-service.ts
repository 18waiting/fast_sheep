// M10 product optimization service (clean-room). Main applies source-authorized
// fields only: guards -> cooldown -> durable backup -> atomic update.
import { guardDetail } from "./optimization-guards.js";
import { CooldownPolicy } from "./cooldown-policy.js";
import { BackupPolicy } from "./backup-policy.js";
import { OptimizationError, OPT_ERROR_CODES } from "./errors.js";
import type { ProductRepositoryPort, OptimizationWorkerClientPort, Clock, EventBus } from "./ports/index.js";
import type { ApplyResult, OptimizationProposal } from "./types.js";

export interface ProductOptimizationServiceOptions {
  repository: ProductRepositoryPort;
  workerClient: OptimizationWorkerClientPort;
  clock?: Clock;
  eventBus?: EventBus;
  cooldownSeconds?: number;
  purgeSeconds?: number;
  dirtyLengthLimit?: number;
}

export class ProductOptimizationService {
  private readonly repo: ProductRepositoryPort;
  private readonly worker: OptimizationWorkerClientPort;
  private readonly clock: Clock;
  private readonly bus: EventBus;
  private readonly cooldown: CooldownPolicy;
  private readonly backup: BackupPolicy;
  private readonly dirtyLengthLimit: number;

  constructor(options: ProductOptimizationServiceOptions) {
    this.repo = options.repository;
    this.worker = options.workerClient;
    this.clock = options.clock ?? { now: () => Date.now() };
    this.bus = options.eventBus ?? { emit: () => {} };
    this.cooldown = new CooldownPolicy(options.cooldownSeconds ?? 3600, options.purgeSeconds ?? 86400);
    this.backup = new BackupPolicy(() => this.clock.now());
    this.dirtyLengthLimit = options.dirtyLengthLimit ?? 20000;
  }

  async propose(productId: string): Promise<OptimizationProposal> {
    const row = this.repo.get(productId);
    if (!row) throw new OptimizationError(OPT_ERROR_CODES.NOT_FOUND, "unknown product");
    const res = await this.worker.propose({ product_id: productId });
    // The worker returns { decisions: { proposal: { detail } } }; unwrap both shapes.
    const proposal = ((res as { decisions?: { proposal?: { detail?: string } } }).decisions?.proposal ?? (res as { proposal?: { detail?: string } }).proposal);
    return { product_id: productId, detail: String(proposal?.detail ?? "") };
  }

  async apply(proposal: OptimizationProposal, opts: { backup?: boolean } = {}): Promise<ApplyResult> {
    const row = this.repo.get(proposal.product_id);
    if (!row) throw new OptimizationError(OPT_ERROR_CODES.NOT_FOUND, "unknown product");
    const guard = guardDetail(proposal.detail, this.dirtyLengthLimit);
    if (guard.dirty) return { applied: false, reason: guard.reason };
    const cd = this.cooldown.isCoolingDown(row.last_optimized_at, this.clock.now());
    if (cd.cooldown) return { applied: false, reason: "cooldown" };
    let backupId: string | undefined;
    if (opts.backup !== false) {
      backupId = this.backup.backupId(proposal.product_id);
      // durable backup is recorded by the desktop service adapter (see background-job-service);
      // here the policy returns the id + dir.
      void this.backup.dir();
    }
    const ok = this.repo.updateDetail(proposal.product_id, proposal.detail, { lastOptimizedAt: new Date(this.clock.now()).toISOString() });
    if (!ok) return { applied: false, reason: "update_failed" };
    this.bus.emit("optimization.applied", { product_id: proposal.product_id });
    return { applied: true, backup_id: backupId };
  }
}
