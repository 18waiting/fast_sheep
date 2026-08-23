// M9 persistence feedback repository adapter (clean-room). Main single-writer.
import type { FeedbackRecord } from "@fastwork/persistence";
import type { FeedbackRepositoryPort } from "../ports/feedback-repository-port.js";

export class PersistenceFeedbackRepository implements FeedbackRepositoryPort {
  constructor(private readonly repo: { add(r: FeedbackRecord): void; list(limit?: number): FeedbackRecord[]; updateEffectStatus(recordId: string, status: FeedbackRecord["effect_status"], extra?: { attempts?: number; lastError?: string | null; appliedAt?: string | null }): void }) {}

  add(record: FeedbackRecord): void { this.repo.add(record); }
  list(limit?: number): FeedbackRecord[] { return this.repo.list(limit); }
  updateEffectStatus(recordId: string, status: FeedbackRecord["effect_status"], extra?: { attempts?: number; lastError?: string | null; appliedAt?: string | null }): void {
    this.repo.updateEffectStatus(recordId, status, extra);
  }
}
