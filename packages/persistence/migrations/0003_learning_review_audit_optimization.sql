-- 0003_learning_review_audit_optimization.sql — M10 durable state (TASK-025).
-- Learning pending queue, review deletion records + rollback snapshots, product
-- cooldown + backups. 0001/0002 remain byte-identical.

CREATE TABLE pending_knowledge (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'LEARNED',
  batch_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE deletion_records (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE review_rollbacks (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE products ADD COLUMN last_optimized_at TEXT;

CREATE TABLE product_backups (
  backup_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
