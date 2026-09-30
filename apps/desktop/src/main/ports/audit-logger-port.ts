/**
 * Audit Logger Port (SHEEP-309).
 *
 * Purpose: Define the interface for SHADOW pipeline audit logging.
 * Records every step of the end-to-end pipeline execution for audit and validation.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation must be auditable.
 * - SHEEP-309: SHADOW mode requires complete audit trail.
 *
 * Key invariants:
 * - Every pipeline execution creates one AuditRun record.
 * - Every step within a run creates one AuditStep record.
 * - Fine-grained events create AuditEvent records.
 * - transport_send_calls MUST = 0 for SHADOW mode (critical safety metric).
 * - All timestamps are ISO 8601 format.
 * - JSON fields are serialized/deserialized by the implementation.
 *
 * Owner SHEEP-309 decisions:
 * D1: Port is defined in Main process (not Orchestrator package) to avoid circular deps.
 * D2: Implementation uses SQLite directly (shares m10Sqlite.conn lifecycle).
 * D3: JSON fields use TEXT storage (SQLite convention).
 */

/**
 * Audit run status.
 */
export type AuditRunStatus = "RUNNING" | "COMPLETED" | "FAILED";

/**
 * Audit step status.
 */
export type AuditStepStatus = "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED";

/**
 * Audit run record (top-level execution record).
 */
export interface AuditRun {
  readonly id: string;
  readonly shopId: string;
  readonly merchantId: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: AuditRunStatus;
  readonly totalMessages: number;
  readonly transportSendCalls: number;
  readonly errorSummary?: Record<string, unknown>;
}

/**
 * Audit step record (per-step execution record).
 */
export interface AuditStep {
  readonly id: string;
  readonly runId: string;
  readonly stepOrder: number;
  readonly stepName: string;
  readonly status: AuditStepStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly inputSummary?: Record<string, unknown>;
  readonly outputSummary?: Record<string, unknown>;
  readonly errorDetail?: Record<string, unknown>;
  readonly durationMs?: number;
}

/**
 * Audit event record (fine-grained event log).
 */
export interface AuditEvent {
  readonly id: string;
  readonly runId: string;
  readonly stepId?: string;
  readonly eventType: string;
  readonly eventData: Record<string, unknown>;
  readonly createdAt: string;
}

/**
 * Run summary (used when completing a run).
 */
export interface RunSummary {
  readonly totalMessages: number;
  readonly transportSendCalls: number;
}

/**
 * AuditLoggerPort: Interface for SHADOW pipeline audit logging.
 *
 * Usage:
 * ```typescript
 * const logger = new AuditLogger(conn);
 * const run = await logger.startRun("shop-1", "merchant-1");
 * try {
 *   await logger.recordStep(run.id, { stepOrder: 1, stepName: "IDENTITY_LOCK", ... });
 *   await logger.completeRun(run.id, { totalMessages: 1, transportSendCalls: 0 });
 * } catch (error) {
 *   await logger.failRun(run.id, error);
 * }
 * ```
 */
export interface AuditLoggerPort {
  /**
   * Start a new audit run.
   *
   * @param shopId - Controlled shop ID
   * @param merchantId - Merchant ID
   * @returns The created AuditRun record
   */
  startRun(shopId: string, merchantId: string): Promise<AuditRun>;

  /**
   * Complete an audit run successfully.
   *
   * @param runId - Run ID to complete
   * @param summary - Run summary (totalMessages, transportSendCalls)
   */
  completeRun(runId: string, summary: RunSummary): Promise<void>;

  /**
   * Mark an audit run as failed.
   *
   * @param runId - Run ID to fail
   * @param error - Error that caused the failure
   */
  failRun(runId: string, error: Error): Promise<void>;

  /**
   * Record a pipeline step.
   *
   * @param runId - Parent run ID
   * @param step - Step data (stepOrder, stepName, status, etc.)
   */
  recordStep(runId: string, step: Omit<AuditStep, "id" | "runId">): Promise<void>;

  /**
   * Record a fine-grained event.
   *
   * @param runId - Parent run ID
   * @param event - Event data (eventType, eventData, etc.)
   */
  recordEvent(runId: string, event: Omit<AuditEvent, "id" | "runId" | "createdAt">): Promise<void>;

  /**
   * Get an audit run by ID.
   *
   * @param runId - Run ID to retrieve
   * @returns The AuditRun record, or null if not found
   */
  getRun(runId: string): Promise<AuditRun | null>;

  /**
   * Get all steps for a run.
   *
   * @param runId - Run ID
   * @returns Array of AuditStep records, ordered by stepOrder
   */
  getSteps(runId: string): Promise<AuditStep[]>;

  /**
   * Get all events for a run.
   *
   * @param runId - Run ID
   * @returns Array of AuditEvent records, ordered by createdAt
   */
  getEvents(runId: string): Promise<AuditEvent[]>;
}
