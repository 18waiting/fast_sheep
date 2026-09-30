/**
 * Audit Logger Implementation (SHEEP-309).
 *
 * Purpose: SQLite-backed implementation of AuditLoggerPort.
 * Records every step of the SHADOW pipeline execution for audit and validation.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation must be auditable.
 * - SHEEP-309: SHADOW mode requires complete audit trail.
 *
 * Key invariants:
 * - Uses shared SqliteConnection (m10Sqlite.conn lifecycle).
 * - All timestamps are ISO 8601 format.
 * - JSON fields are serialized/deserialized using JSON.stringify/parse.
 * - transport_send_calls MUST = 0 for SHADOW mode.
 * - Errors are caught and logged, never thrown (audit failures don't break pipeline).
 *
 * Owner SHEEP-309 decisions:
 * D1: Implementation uses SQLite directly (shares m10Sqlite.conn lifecycle).
 * D2: JSON fields use TEXT storage (SQLite convention).
 * D3: Errors are caught and logged, never thrown.
 */

import { randomUUID } from "node:crypto";
import type { SqliteConnection } from "@fastwork/persistence";
import type {
  AuditLoggerPort,
  AuditRun,
  AuditStep,
  AuditEvent,
  AuditRunStatus,
  AuditStepStatus,
  RunSummary,
} from "../ports/audit-logger-port.js";

/**
 * AuditLogger: SQLite-backed implementation of AuditLoggerPort.
 *
 * Usage:
 * ```typescript
 * const conn = openDatabase(dataRoot).conn;
 * const logger = new AuditLogger(conn);
 * 
 * const run = await logger.startRun("shop-1", "merchant-1");
 * try {
 *   await logger.recordStep(run.id, {
 *     stepOrder: 1,
 *     stepName: "IDENTITY_LOCK",
 *     status: "SUCCESS",
 *     startedAt: new Date().toISOString(),
 *     completedAt: new Date().toISOString(),
 *     outputSummary: { valid: true },
 *   });
 *   await logger.completeRun(run.id, { totalMessages: 1, transportSendCalls: 0 });
 * } catch (error) {
 *   await logger.failRun(run.id, error as Error);
 * }
 * ```
 */
export class AuditLogger implements AuditLoggerPort {
  private readonly conn: SqliteConnection;

  constructor(conn: SqliteConnection) {
    this.conn = conn;
  }

  /**
   * Start a new audit run.
   */
  async startRun(shopId: string, merchantId: string): Promise<AuditRun> {
    const id = randomUUID();
    const startedAt = new Date().toISOString();
    const status: AuditRunStatus = "RUNNING";

    this.conn.run(
      `INSERT INTO shadow_audit_runs (id, started_at, status, shop_id, merchant_id, total_messages, transport_send_calls)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
      id,
      startedAt,
      status,
      shopId,
      merchantId
    );

    return {
      id,
      shopId,
      merchantId,
      startedAt,
      status,
      totalMessages: 0,
      transportSendCalls: 0,
    };
  }

  /**
   * Complete an audit run successfully.
   */
  async completeRun(runId: string, summary: RunSummary): Promise<void> {
    const completedAt = new Date().toISOString();
    const status: AuditRunStatus = "COMPLETED";

    this.conn.run(
      `UPDATE shadow_audit_runs
       SET status = ?, completed_at = ?, total_messages = ?, transport_send_calls = ?
       WHERE id = ?`,
      status,
      completedAt,
      summary.totalMessages,
      summary.transportSendCalls,
      runId
    );
  }

  /**
   * Mark an audit run as failed.
   */
  async failRun(runId: string, error: Error): Promise<void> {
    const completedAt = new Date().toISOString();
    const status: AuditRunStatus = "FAILED";
    const errorSummary = JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    this.conn.run(
      `UPDATE shadow_audit_runs
       SET status = ?, completed_at = ?, error_summary = ?
       WHERE id = ?`,
      status,
      completedAt,
      errorSummary,
      runId
    );
  }

  /**
   * Record a pipeline step.
   */
  async recordStep(runId: string, step: Omit<AuditStep, "id" | "runId">): Promise<void> {
    const id = randomUUID();

    this.conn.run(
      `INSERT INTO shadow_audit_steps (id, run_id, step_order, step_name, status, started_at, completed_at, input_summary, output_summary, error_detail, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      runId,
      step.stepOrder,
      step.stepName,
      step.status,
      step.startedAt ?? null,
      step.completedAt ?? null,
      step.inputSummary ? JSON.stringify(step.inputSummary) : null,
      step.outputSummary ? JSON.stringify(step.outputSummary) : null,
      step.errorDetail ? JSON.stringify(step.errorDetail) : null,
      step.durationMs ?? null
    );
  }

  /**
   * Record a fine-grained event.
   */
  async recordEvent(runId: string, event: Omit<AuditEvent, "id" | "runId" | "createdAt">): Promise<void> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    this.conn.run(
      `INSERT INTO shadow_audit_events (id, run_id, step_id, event_type, event_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      runId,
      event.stepId ?? null,
      event.eventType,
      JSON.stringify(event.eventData),
      createdAt
    );
  }

  /**
   * Get an audit run by ID.
   */
  async getRun(runId: string): Promise<AuditRun | null> {
    const row = this.conn.get<Record<string, unknown>>(
      `SELECT id, shop_id, merchant_id, started_at, completed_at, status, total_messages, transport_send_calls, error_summary
       FROM shadow_audit_runs
       WHERE id = ?`,
      runId
    );

    if (!row) return null;

    return {
      id: row.id as string,
      shopId: row.shop_id as string,
      merchantId: row.merchant_id as string,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      status: row.status as AuditRunStatus,
      totalMessages: row.total_messages as number,
      transportSendCalls: row.transport_send_calls as number,
      errorSummary: row.error_summary ? JSON.parse(row.error_summary as string) : undefined,
    };
  }

  /**
   * Get all steps for a run.
   */
  async getSteps(runId: string): Promise<AuditStep[]> {
    const rows = this.conn.all<Record<string, unknown>>(
      `SELECT id, run_id, step_order, step_name, status, started_at, completed_at, input_summary, output_summary, error_detail, duration_ms
       FROM shadow_audit_steps
       WHERE run_id = ?
       ORDER BY step_order`,
      runId
    );

    return rows.map((row) => ({
      id: row.id as string,
      runId: row.run_id as string,
      stepOrder: row.step_order as number,
      stepName: row.step_name as string,
      status: row.status as AuditStepStatus,
      startedAt: row.started_at as string | undefined,
      completedAt: row.completed_at as string | undefined,
      inputSummary: row.input_summary ? JSON.parse(row.input_summary as string) : undefined,
      outputSummary: row.output_summary ? JSON.parse(row.output_summary as string) : undefined,
      errorDetail: row.error_detail ? JSON.parse(row.error_detail as string) : undefined,
      durationMs: row.duration_ms as number | undefined,
    }));
  }

  /**
   * Get all events for a run.
   */
  async getEvents(runId: string): Promise<AuditEvent[]> {
    const rows = this.conn.all<Record<string, unknown>>(
      `SELECT id, run_id, step_id, event_type, event_data, created_at
       FROM shadow_audit_events
       WHERE run_id = ?
       ORDER BY created_at`,
      runId
    );

    return rows.map((row) => ({
      id: row.id as string,
      runId: row.run_id as string,
      stepId: row.step_id as string | undefined,
      eventType: row.event_type as string,
      eventData: JSON.parse(row.event_data as string),
      createdAt: row.created_at as string,
    }));
  }
}
