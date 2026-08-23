// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { FeedbackRepository, FeedbackRecord } from "../repositories/feedback-repository.js";
export class InMemoryFeedbackRepository implements FeedbackRepository {
  private rows: FeedbackRecord[] = [];
  add(r: FeedbackRecord): void { this.rows.push({ ...r, effect_status: r.effect_status ?? "PENDING", attempts: r.attempts ?? 0 }); }
  list(limit = 500): FeedbackRecord[] { return [...this.rows].slice(0, limit); }
  updateEffectStatus(recordId: string, status: FeedbackRecord["effect_status"], extra?: { attempts?: number; lastError?: string | null; appliedAt?: string | null }): void {
    const row = this.rows.find((r) => r.record_id === recordId);
    if (row) { row.effect_status = status; if (extra?.attempts !== undefined) row.attempts = extra.attempts; if (extra?.lastError !== undefined) row.last_error = extra.lastError; if (extra?.appliedAt !== undefined) row.applied_at = extra.appliedAt; }
  }
}
