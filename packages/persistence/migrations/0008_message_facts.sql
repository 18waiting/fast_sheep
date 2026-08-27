-- 0008_message_facts.sql — Message fact contract foundation (SHEEP-063-PR1).
-- Append-only forward migration; 0001-0007 unchanged (v7 -> v8).
--
-- DP-83 MESSAGE_FACT_CONTRACT_PRECEDES_STORAGE_SHAPE: this migration adds the minimal
-- typed fact columns required by the message fact contract. It does NOT invent
-- unread/priority/risk/Queue DTOs, summary, activity ordering, or a generic metadata
-- JSON bag.
--
-- Fact contract (typed, text-first):
--   identity     : id (internal authoritative MessageId, I-13). external_ref stays
--                  OPAQUE text (no invented UNIQUE — external_ref uniqueness scope
--                  has not been confirmed; I-13 internal/external identity remain
--                  distinct).
--   actor        : customer | agent (DP-86 + I-15) — conversation actor semantics,
--                  NOT LLM roles. No AI actor is pre-invented; AI-assisted generation
--                  provenance is ORTHOGONAL to message actor (I-15) and is NOT modeled
--                  in this migration. NULL = unknown (I-16).
--   content      : typed + extensible, text-first (DP-88). content_kind='text' only
--                  for PR1; attachments/rich payload remain SHEEP-065. NULL = unknown.
--   time         : occurred_at = source/platform occurrence time, MAY be unknown (DP-87);
--                  observed_at = Fast Sheep observed/ingested time, produced by the Main
--                  ingestion boundary (DP-87). No ambiguous created_at is used.
--   provenance   : minimal typed facts only (external_ref + occurred_at + observed_at);
--                  no metadata JSON bag.
--   ordering     : policy separate from persisted facts (I-12); applied at query time.
--
-- I-16 MIGRATION_MUST_NOT_FABRICATE_HISTORICAL_MESSAGE_FACTS: pre-existing
-- normalized_messages rows (fact-less) keep NULL for every new fact column. No
-- system/empty-text/migration-time backfill is performed.

ALTER TABLE normalized_messages ADD COLUMN actor TEXT CHECK (actor IN ('customer','agent') OR actor IS NULL);
ALTER TABLE normalized_messages ADD COLUMN content_kind TEXT CHECK (content_kind IN ('text') OR content_kind IS NULL);
ALTER TABLE normalized_messages ADD COLUMN content_text TEXT;
ALTER TABLE normalized_messages ADD COLUMN occurred_at TEXT;
ALTER TABLE normalized_messages ADD COLUMN observed_at TEXT;
