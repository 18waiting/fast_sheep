// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface FeedbackRecord {
  record_id: string;
  conversation_id: string;
  class: string;
  trust_level: string;
  target_ref?: string | null;
  message_ref?: string | null;
  created_at: string;
  effect_status?: "PENDING" | "APPLIED" | "FAILED_RETRYABLE" | "FAILED_FINAL";
  attempts?: number;
  last_error?: string | null;
  applied_at?: string | null;
}
export interface FeedbackRepository {
  add(r: FeedbackRecord): void;
  list(limit?: number): FeedbackRecord[];
  updateEffectStatus(recordId: string, status: FeedbackRecord["effect_status"], extra?: { attempts?: number; lastError?: string | null; appliedAt?: string | null }): void;
}
