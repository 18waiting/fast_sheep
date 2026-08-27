// SHEEP-063-PR1: thin Main-side Message ingestion write boundary.
// DP-67 + Owner constraints: thin append/persist boundary — NO upsert/merge/dedupe/
// reconciliation/idempotency/platform normalization (real producer ingestion
// semantics remain DEFERRED).
//
// Contract:
// - DP-86 + I-15: actor is a CONVERSATION actor (customer | agent), never an LLM
//   role. AI-assisted generation provenance is orthogonal to actor and is NOT part
//   of this boundary's input.
// - DP-87: observed_at (Fast Sheep observed/ingested time) is produced at this
//   trusted Main ingestion boundary when the producer did not supply it; the
//   repository only persists facts and never fabricates provenance.
// - DP-88: content is typed + extensible, text-first. Only 'text' kind is accepted;
//   attachments/rich payload remain SHEEP-065.
// - I-16: unknown historical facts stay unknown. This boundary only ingests NEW
//   facts with a defined actor + typed text content; it never stores fabricated
//   system/empty/unknown values for new writes.
import type { MessageRecord, MessageRepository } from "@fastwork/persistence";

export interface MessageIngestion {
  saveNormalizedMessage(record: MessageRecord): void;
}

export function createMessageIngestion(repository: MessageRepository): MessageIngestion {
  return {
    saveNormalizedMessage(record) {
      if (record.actor !== "customer" && record.actor !== "agent") {
        throw new Error(
          "message ingestion requires a conversation actor (customer|agent); unknown actor must be resolved by the producer, not fabricated"
        );
      }
      if (record.contentKind !== "text" || typeof record.contentText !== "string") {
        throw new Error("message ingestion requires typed text content (contentKind='text' + contentText string)");
      }
      // DP-87: observed_at is produced here (Fast Sheep observed time).
      const observedAt = record.observedAt ?? new Date().toISOString();
      repository.save({ ...record, observedAt });
    },
  };
}
