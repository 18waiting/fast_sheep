// M9 feedback idempotency (clean-room). In-memory bound + durable effect-status check.
import type { FeedbackRepository, FeedbackRecord } from "@fastwork/persistence";

export class FeedbackIdempotency {
  private readonly seen = new Set<string>();
  constructor(private readonly maxSize = 2048) {}

  isDuplicate(recordId: string): boolean {
    return this.seen.has(recordId);
  }

  mark(recordId: string): void {
    this.seen.add(recordId);
    if (this.seen.size > this.maxSize) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }

  /** Durable check: a record already APPLIED must not re-apply. */
  isEffectApplied(repo: FeedbackRepository, recordId: string): boolean {
    const rec = repo.list(10000).find((r: FeedbackRecord) => r.record_id === recordId);
    return rec?.effect_status === "APPLIED";
  }
}
