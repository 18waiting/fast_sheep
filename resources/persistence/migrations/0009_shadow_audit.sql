-- 0009_shadow_audit.sql — SHEEP-309 SHADOW End-to-End Audit persistence.
-- Append-only; 0001-0008 unchanged.
-- Purpose: Record every step of the SHADOW pipeline execution for audit and validation.
-- 
-- Tables:
-- - shadow_audit_runs: One record per end-to-end execution
-- - shadow_audit_steps: One record per pipeline step (11 steps total)
-- - shadow_audit_events: Fine-grained event log for diagnostics
--
-- Key invariants:
-- - transport_send_calls in shadow_audit_runs MUST = 0 for SHADOW mode
-- - All timestamps are ISO 8601 format
-- - JSON fields use TEXT storage (SQLite convention)
-- - Idempotent: can be executed multiple times without error (IF NOT EXISTS)
-- - No FK constraints (structural scope only; FK may reference non-existent rows during development)
-- - No ON DELETE CASCADE (retention semantics deferred)

-- ============================================================================
-- shadow_audit_runs: Top-level execution record
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_audit_runs (
  id TEXT PRIMARY KEY,                          -- UUID (randomUUID)
  started_at TEXT NOT NULL,                     -- ISO 8601: when the run started
  completed_at TEXT,                            -- ISO 8601: when the run completed (NULL = in progress)
  status TEXT NOT NULL DEFAULT 'RUNNING'        -- Execution status
    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  shop_id TEXT NOT NULL,                        -- Controlled shop ID
  merchant_id TEXT NOT NULL,                    -- Merchant ID
  total_messages INTEGER NOT NULL DEFAULT 0,    -- Total inbound messages processed
  transport_send_calls INTEGER NOT NULL DEFAULT 0,  -- CRITICAL SAFETY METRIC: must = 0 for SHADOW
  error_summary TEXT                            -- JSON: error summary if status = FAILED
);

-- Indexes for shadow_audit_runs
CREATE INDEX IF NOT EXISTS idx_shadow_audit_runs_shop ON shadow_audit_runs(shop_id);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_runs_status ON shadow_audit_runs(status);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_runs_started ON shadow_audit_runs(started_at);

-- ============================================================================
-- shadow_audit_steps: Per-step execution record (11 steps in SHADOW pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_audit_steps (
  id TEXT PRIMARY KEY,                          -- UUID (randomUUID)
  run_id TEXT NOT NULL,                         -- Parent run ID (logical FK → shadow_audit_runs.id)
  step_order INTEGER NOT NULL,                  -- Step sequence number (1-11)
  step_name TEXT NOT NULL,                      -- Step identifier (e.g., "IDENTITY_LOCK", "PERSISTENCE")
  status TEXT NOT NULL DEFAULT 'PENDING'        -- Step execution status
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED')),
  started_at TEXT,                              -- ISO 8601: when the step started
  completed_at TEXT,                            -- ISO 8601: when the step completed
  input_summary TEXT,                           -- JSON: input data summary (key fields only)
  output_summary TEXT,                          -- JSON: output data summary (key fields only)
  error_detail TEXT,                            -- JSON: error details if status = FAILED
  duration_ms INTEGER                           -- Execution duration in milliseconds
);

-- Indexes for shadow_audit_steps
CREATE INDEX IF NOT EXISTS idx_shadow_audit_steps_run ON shadow_audit_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_steps_order ON shadow_audit_steps(run_id, step_order);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_steps_status ON shadow_audit_steps(status);

-- ============================================================================
-- shadow_audit_events: Fine-grained event log for diagnostics
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_audit_events (
  id TEXT PRIMARY KEY,                          -- UUID (randomUUID)
  run_id TEXT NOT NULL,                         -- Parent run ID (logical FK → shadow_audit_runs.id)
  step_id TEXT,                                 -- Optional step ID (logical FK → shadow_audit_steps.id)
  event_type TEXT NOT NULL,                     -- Event type identifier (e.g., "RPC_CALL", "POLICY_EVAL")
  event_data TEXT NOT NULL,                     -- JSON: event payload
  created_at TEXT NOT NULL                      -- ISO 8601: when the event was created
);

-- Indexes for shadow_audit_events
CREATE INDEX IF NOT EXISTS idx_shadow_audit_events_run ON shadow_audit_events(run_id);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_events_step ON shadow_audit_events(step_id);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_events_type ON shadow_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_shadow_audit_events_created ON shadow_audit_events(created_at);

-- ============================================================================
-- Step name reference (for documentation, not enforced by DB)
-- ============================================================================
-- Step 1:  IDENTITY_LOCK        — Validate IdentityLock (SHEEP-300)
-- Step 2:  PERSISTENCE          — Persist normalized inbound message (SHEEP-302)
-- Step 3:  TURN_BUILD           — Aggregate messages into AI Turn (SHEEP-303)
-- Step 4:  SCENE_CLASSIFY       — Classify scene (SHEEP-304)
-- Step 5:  KNOWLEDGE_RETRIEVAL  — Retrieve knowledge (SHEEP-305)
-- Step 6:  ENVELOPE_BUILD       — Build ContextEnvelope (SHEEP-306)
-- Step 7:  REPLY_PLAN           — Generate ReplyPlan via RPC (SHEEP-307)
-- Step 8:  POLICY_EVAL          — Evaluate policy (SHEEP-308)
-- Step 9:  AUDIT_PERSIST        — Confirm audit persistence completeness (SHEEP-309)
-- Step 10: TRANSPORT_VERIFY    — Verify TRANSPORT SEND CALLS = 0 (SHEEP-309)
-- Step 11: RUN_COMPLETE         — Mark run as completed (SHEEP-309)
