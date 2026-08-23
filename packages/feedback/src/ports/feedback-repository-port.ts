// M9 feedback ports (clean-room).
import type { FeedbackRecord } from "@fastwork/persistence";

export interface FeedbackRepositoryPort {
  add(record: FeedbackRecord): void;
  list(limit?: number): FeedbackRecord[];
  updateEffectStatus(recordId: string, status: FeedbackRecord["effect_status"], extra?: { attempts?: number; lastError?: string | null; appliedAt?: string | null }): void;
}
