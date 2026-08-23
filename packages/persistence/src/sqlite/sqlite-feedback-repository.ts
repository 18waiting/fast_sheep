// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { FeedbackRepository, FeedbackRecord } from "../repositories/feedback-repository.js";
import { runInTransaction } from "../db/transaction.js";

export class SqliteFeedbackRepository implements FeedbackRepository {
  constructor(private conn: SqliteConnection) {}
  add(r: FeedbackRecord): void { runInTransaction(this.conn, () => { this.conn.run("INSERT INTO feedback_records (record_id, conversation_id, class, trust_level, target_ref, message_ref, created_at, effect_status, attempts, last_error, applied_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", r.record_id, r.conversation_id, r.class, r.trust_level, r.target_ref ?? null, r.message_ref ?? null, r.created_at, (r.effect_status ?? "PENDING") as string, (r.attempts ?? 0) as number, (r.last_error ?? "") as string, r.applied_at ?? null); }); }
  list(limit = 500): FeedbackRecord[] { return this.conn.all("SELECT record_id, conversation_id, class, trust_level, target_ref, message_ref, created_at, effect_status, attempts, last_error, applied_at FROM feedback_records ORDER BY created_at DESC LIMIT ?", limit); }
  updateEffectStatus(recordId: string, status: FeedbackRecord["effect_status"], extra?: { attempts?: number; lastError?: string | null; appliedAt?: string | null }): void {
    runInTransaction(this.conn, () => {
      this.conn.run("UPDATE feedback_records SET effect_status = ?, attempts = COALESCE(?, attempts), last_error = ?, applied_at = COALESCE(?, applied_at) WHERE record_id = ?", (status ?? "PENDING") as string, (extra?.attempts ?? null) as never, (extra?.lastError ?? "") as string, extra?.appliedAt ?? null, recordId);
    });
  }
}
