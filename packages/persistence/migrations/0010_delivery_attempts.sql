-- 0010_delivery_attempts.sql — Durable Text Delivery Attempt journal (SHEEP-066-PR1).
-- Append-only forward migration; 0001-0009 unchanged (v9 -> v10).
--
-- This journal is a platform-independent, DURABLE Send Attempt truth model. It is
-- STRICTLY DISTINCT from:
--   * normalized_messages   (delivered conversation message facts; DP-127/I-35)
--   * Cloud Sync Outbox     (out of scope; DP-127)
--
-- Contract (SHEEP-066-PR1):
--   DP-119  attempt input is the Composer submit intent {conversationId, draft} (I-30).
--   I-37    target identity (conversation/store/platform_account) is captured at
--           creation from the AUTHORIZED conversation, never from renderer/queue scope.
--   I-34    text_payload is an IMMUTABLE text snapshot (full text, not a hash) —
--           recovery never depends on an ephemeral Composer draft.
--   status  PENDING -> IN_FLIGHT -> ACKNOWLEDGED | REJECTED | UNKNOWN (DP-122/125);
--           terminal states are immutable; retry creates a NEW attempt (I-38).
--   I-39    IN_FLIGHT is persisted BEFORE any external delivery side effect.
--   DP-130  ACKNOWLEDGED finalization + delivered message fact persistence are
--           ATOMIC (same transaction) or recoverably idempotent (I-40).
--   I-40    delivered_message_id is the unique typed link; repeat finalize is a no-op
--           (no duplicate Timeline message).
--   DP-128  unresolved IN_FLIGHT after crash/reopen recovers as UNKNOWN (not FAILED).
--   #8/#10  ack_source_ref / ack_occurred_at are typed driver source facts only (no raw
--           response JSON); lifecycle times (created/dispatched/resolved) are local
--           facts and never masquerade as Message.occurred_at.
--   #9      NO free-text reconciliation_note in v1 (reconciliation modeled later).
--   I-41    text_payload is customer business data: it may live in the local DB /
--           backups but MUST NOT be emitted to logs/telemetry/error strings by default.

CREATE TABLE delivery_attempts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES normalized_conversations(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  text_payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','IN_FLIGHT','ACKNOWLEDGED','REJECTED','UNKNOWN')),
  created_at TEXT NOT NULL,
  dispatched_at TEXT,
  resolved_at TEXT,
  delivered_message_id TEXT REFERENCES normalized_messages(id),
  ack_source_ref TEXT,
  ack_occurred_at TEXT
);
CREATE INDEX idx_da_conversation ON delivery_attempts(conversation_id);
CREATE INDEX idx_da_status ON delivery_attempts(status);
