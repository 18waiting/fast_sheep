-- 0002_feedback_effect_tracking.sql — M9 durable feedback effect tracking (TASK-024).
-- Adds durable effect-status columns to feedback_records so knowledge effects are
-- idempotent and recoverable across process boundaries. 0001 remains byte-identical.

ALTER TABLE feedback_records ADD COLUMN effect_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE feedback_records ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feedback_records ADD COLUMN last_error TEXT NOT NULL DEFAULT '';
ALTER TABLE feedback_records ADD COLUMN applied_at TEXT;
CREATE INDEX idx_feedback_effect_status ON feedback_records(effect_status);
