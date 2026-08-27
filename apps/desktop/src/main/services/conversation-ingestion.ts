// SHEEP-060-PR1: thin Main-side Conversation ingestion write boundary.
// DP-67 CONVERSATION_INGESTION_IS_A_THIN_PRODUCTION_WRITE_BOUNDARY.
// Contract accurately reflects current persistence semantics: repository.save is a
// plain INSERT (no upsert / merge / dedupe / reconciliation / platform normalization).
// This is the formal write boundary for future platform/import producers;
// it is NOT a domain service, event bus, Outbox, or sync engine.
import type { NormalizedConversationRecord, NormalizedConversationRepository } from "@fastwork/persistence";

export interface ConversationIngestion {
  saveNormalizedConversation(record: NormalizedConversationRecord): void;
}

export function createConversationIngestion(repository: NormalizedConversationRepository): ConversationIngestion {
  return {
    saveNormalizedConversation(record) {
      repository.save(record);
    },
  };
}