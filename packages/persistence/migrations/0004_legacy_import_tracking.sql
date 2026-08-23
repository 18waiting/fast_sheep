-- 0004_legacy_import_tracking.sql — M11 durable import session tracking (TASK-026).
-- 0001/0002/0003 remain byte-identical. No secrets are ever stored here.

CREATE TABLE IF NOT EXISTS legacy_import_sessions (
  session_id TEXT PRIMARY KEY,
  selection_id TEXT NOT NULL,
  plan_sha256 TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MAIN_PREPARED',
  phases_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  backup_id TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS legacy_import_items (
  item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES legacy_import_sessions(session_id) ON DELETE CASCADE,
  selection_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_aggregate TEXT NOT NULL,
  target_writer TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  source_sha256 TEXT NOT NULL,
  inserted INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  applied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_import_items_session ON legacy_import_items(session_id);
