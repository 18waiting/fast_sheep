-- 0001_initial.sql — M1 canonical clean-room schema (TASK-016).
-- Columns derive from spec/rebuild/domain-contracts.md + M0 JSON Schemas.
-- Persistence-only fields are marked DESIGN in spec/rebuild/m1-schema-report.md.

CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- platform enum (pdd|doudian|jd|kuaishou|qianniu|xianyu)
  name TEXT NOT NULL,
  created_time TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0        -- DESIGN field (order)
);

CREATE TABLE config_groups (
  group_name TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,       -- validated against M0 JSON Schema before commit
  updated_at TEXT NOT NULL          -- DESIGN field
);

CREATE TABLE products (
  product_id TEXT PRIMARY KEY,      -- 主ID; merged 主ID|附属ID stored as-is
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  shop TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',    -- 备注
  created_at TEXT NOT NULL,         -- DESIGN field
  updated_at TEXT NOT NULL          -- DESIGN field
);

CREATE TABLE conversations (
  conversation_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  buyer TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active'   -- active|pending_review|taken_over|closed
);

CREATE TABLE conversation_messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  buyer TEXT NOT NULL,
  type TEXT NOT NULL,               -- text|image|video|transfer_marker|system
  content TEXT NOT NULL,
  role TEXT NOT NULL,               -- buyer|ai|human
  created_at TEXT NOT NULL,
  product_context TEXT,             -- JSON
  order_context TEXT,               -- JSON
  metadata TEXT                     -- JSON
);
CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id, created_at);
CREATE INDEX idx_conversations_shop ON conversations(shop_id, updated_at);
CREATE INDEX idx_conversations_buyer ON conversations(buyer, updated_at);

CREATE TABLE prompt_profiles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  order_status_binding TEXT NOT NULL DEFAULT 'all',   -- 未下单|已下单|all
  mounted_skills TEXT NOT NULL DEFAULT '[]',          -- JSON array
  created_at TEXT NOT NULL,         -- DESIGN field
  updated_at TEXT NOT NULL          -- DESIGN field
);

CREATE TABLE skills (
  skill_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  asset_path TEXT NOT NULL,         -- filesystem asset root (skills live on disk)
  signature TEXT,                   -- content hash / signature (DESIGN field)
  metadata TEXT NOT NULL DEFAULT '{}'  -- JSON (DESIGN field)
);

CREATE TABLE product_skill_mounts (
  product_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  PRIMARY KEY (product_id, skill_id)
);

CREATE TABLE transfer_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  transfer_to TEXT NOT NULL DEFAULT '',
  transfer_message TEXT NOT NULL DEFAULT '',
  work_hours TEXT NOT NULL DEFAULT '',
  source_agent TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '禁用',
  order_state TEXT NOT NULL DEFAULT '',
  applicable_shops TEXT NOT NULL DEFAULT '',   -- comma-separated shop names
  sort_order INTEGER NOT NULL DEFAULT 0,       -- DESIGN field (ordering)
  enabled INTEGER NOT NULL DEFAULT 1           -- DESIGN field (enable state)
);

CREATE TABLE forbidden_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  replacement TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0        -- DESIGN field
);

CREATE TABLE feedback_records (
  record_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  class TEXT NOT NULL,              -- AUTO|MANUAL|NO_SAVE|CORRECTION|AUDIT_APPROVE|RESTORE
  trust_level TEXT NOT NULL,        -- AUTO|GENERATED|PENDING|HUMAN_CONFIRMED|PROTECTED
  target_ref TEXT,
  message_ref TEXT,
  created_at TEXT
);

CREATE TABLE stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stat_key TEXT NOT NULL UNIQUE,
  stat_value TEXT NOT NULL,         -- JSON (generic typed counters only; no premature business metrics)
  updated_at TEXT NOT NULL          -- DESIGN field
);

CREATE TABLE background_jobs (
  job_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- learning|index_rebuild|knowledge_review|product_optimization|cloud_sync
  state TEXT NOT NULL,              -- QUEUED|RUNNING|CANCELLING|COMPLETED|FAILED|CANCELLED
  progress REAL NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  finished_at TEXT,
  cancellation_token TEXT,
  error TEXT,                       -- JSON (normalized error, no stack traces)
  result TEXT                       -- JSON
);

CREATE INDEX idx_jobs_state_type ON background_jobs(state, type);

CREATE TABLE knowledge_entries (
  id TEXT PRIMARY KEY,              -- entry_id content hash
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  product_id TEXT NOT NULL,         -- ''=无商品ID, '1'=通用
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON array
  source TEXT NOT NULL DEFAULT '',
  trust_level TEXT NOT NULL,        -- AUTO|GENERATED|PENDING|HUMAN_CONFIRMED|PROTECTED
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_products_shop ON products(shop);
CREATE INDEX idx_knowledge_product_trust ON knowledge_entries(product_id, trust_level);

CREATE TABLE knowledge_candidates (
  candidate_id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  product_id TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON array
  origin TEXT NOT NULL,             -- LEARNED|GENERATED|CORRECTION|AUTO_INGEST|REVIEW|RESTORE
  status TEXT NOT NULL,             -- PENDING_REVIEW|APPROVED|REJECTED|PENDING_REAUDIT|COMMITTED
  frequency TEXT,                   -- JSON
  evidence TEXT                     -- JSON
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);


