-- 0006_conversation_domain.sql — Phase 1 conversation domain persistence (SHEEP-019-B).
-- Append-only; 0001-0005 unchanged; legacy tables (conversations/conversation_messages) coexist.
-- Entities: normalized_conversations (store_id CONFIRMED), normalized_messages, ownership_records.
-- NOTE:
-- - ownership_records is SNAPSHOT STRUCTURE only: no CHECK on state, and no state<->owner
--   combination rules (transition semantics -> M1.5/Phase 4/Phase 12).
-- - owner_member_id is an identity reference only; NO authority validation here.
-- - external_ref is OPAQUE TEXT (no unified externalConversationId/platformMessageId semantics).
-- - messages/ownership do NOT repeat merchant_id (single fact source = conversation).

CREATE TABLE normalized_conversations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  external_ref TEXT
);
CREATE INDEX idx_nconv_merchant ON normalized_conversations(merchant_id);
CREATE INDEX idx_nconv_store ON normalized_conversations(store_id);

CREATE TABLE normalized_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES normalized_conversations(id),
  external_ref TEXT
);
CREATE INDEX idx_nmsg_conversation ON normalized_messages(conversation_id);

CREATE TABLE ownership_records (
  conversation_id TEXT PRIMARY KEY REFERENCES normalized_conversations(id),
  state TEXT NOT NULL,
  owner_kind TEXT,
  owner_member_id TEXT
);