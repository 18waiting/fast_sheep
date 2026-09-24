-- 0008_store_knowledge.sql — SHEEP-305 Store Knowledge persistence (DEC-008 layer 3).
-- Append-only; 0001-0007 unchanged.
-- Entities: store_knowledge (merchant-configured store rules and facts).
-- NOTE:
-- - Store Knowledge is scoped to merchant + store (DEC-008 layer 3).
-- - knowledge_type is TEXT with CHECK constraint (extensible enum).
-- - tags stored as JSON text array (consistent with knowledge_entries pattern).
-- - No FK to stores table (store may not exist yet during import; structural scope only).
-- - No ON DELETE CASCADE (delete/retention semantics deferred).
-- - MVP-A: keyword retrieval via LIKE. Phase 9: vector retrieval (separate task).

CREATE TABLE store_knowledge (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('SHIPPING_TIME', 'RETURN_POLICY', 'FAQ', 'OTHER')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'OWNER_INPUT' CHECK (source IN ('OWNER_INPUT', 'IMPORTED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Scope queries: by merchant, by store, by type
CREATE INDEX idx_store_knowledge_merchant ON store_knowledge(merchant_id);
CREATE INDEX idx_store_knowledge_store ON store_knowledge(store_id);
CREATE INDEX idx_store_knowledge_type ON store_knowledge(knowledge_type);
CREATE INDEX idx_store_knowledge_status ON store_knowledge(status);

-- Composite index for typical query pattern: merchant + store + type + active
CREATE INDEX idx_store_knowledge_scope ON store_knowledge(merchant_id, store_id, knowledge_type, status);
