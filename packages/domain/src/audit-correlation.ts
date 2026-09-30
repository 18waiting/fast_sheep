/**
 * Audit Correlation Domain (SHEEP-311).
 *
 * Governance basis:
 * - REPLY_AND_ACTION_SAFETY: Persistent audit is required.
 * - AI_CUSTOMER_SERVICE_CORE: Audit correlation is complete.
 *
 * Key invariants:
 * - AuditCorrelation is the immutable record of a complete execution audit trail.
 * - All events (confirmation, verification, outcome, notification) are linked to the same audit_id.
 * - Audit trails are traceable and complete.
 * - Audit records are immutable and auditable.
 *
 * Owner SHEEP-311 decisions:
 * D1: AuditCorrelation is a structured, type-safe audit trail.
 * D2: All events are linked to the same audit_id.
 * D3: Audit trails are immutable and traceable.
 */

import type { TransportOutcome } from "./transport-outcome.js";
import type { ConfirmationBinding } from "./confirmation-binding.js";
import type { VerificationRecord } from "./verification-record.js";
import type { DesktopNotification } from "./desktop-notification.js";

/**
 * AuditStatus: The status of an audit trail.
 *
 * - IN_PROGRESS: Audit is still being recorded.
 * - COMPLETED: Audit is complete.
 * - FAILED: Audit failed (e.g., missing required events).
 */
export type AuditStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

/**
 * AuditCorrelation: The immutable record of a complete execution audit trail.
 *
 * This interface represents the complete audit trail for a single execution,
 * linking all events (confirmation, verification, outcome, notification) to
 * the same audit_id.
 *
 * Usage:
 * ```typescript
 * const audit: AuditCorrelation = {
 *   audit_id: "audit-123",
 *   shop_id: "shop-1",
 *   conversation_id: "conv-1",
 *   plan_id: "plan-456",
 *   status: "COMPLETED",
 *   created_at: "2026-09-30T10:00:00Z",
 *   completed_at: "2026-09-30T10:00:05Z",
 *   confirmation: confirmationBinding,
 *   verifications: [verificationRecord1, verificationRecord2],
 *   outcome: transportOutcome,
 *   notification: desktopNotification,
 * };
 * ```
 */
export interface AuditCorrelation {
  /**
   * Unique identifier for this audit trail.
   * All events in this audit are linked to this ID.
   */
  readonly audit_id: string;

  /**
   * The shop ID for this execution.
   */
  readonly shop_id: string;

  /**
   * The conversation ID for this execution.
   */
  readonly conversation_id: string;

  /**
   * The ReplyPlan ID for this execution.
   */
  readonly plan_id: string;

  /**
   * The status of the audit trail.
   */
  readonly status: AuditStatus;

  /**
   * ISO 8601 timestamp when the audit was created.
   */
  readonly created_at: string;

  /**
   * ISO 8601 timestamp when the audit was completed.
   * Undefined if status is IN_PROGRESS.
   */
  readonly completed_at?: string;

  /**
   * The human confirmation binding (if applicable).
   * Required for HUMAN_CONFIRM mode.
   */
  readonly confirmation?: ConfirmationBinding;

  /**
   * List of verification records for this execution.
   * Includes all pre-execution verifications.
   */
  readonly verifications: readonly VerificationRecord[];

  /**
   * The transport outcome for this execution.
   * The result of attempting to send the message.
   */
  readonly outcome?: TransportOutcome;

  /**
   * The desktop notification for this execution.
   * The notification delivered to the user.
   */
  readonly notification?: DesktopNotification;

  /**
   * Optional metadata for additional context.
   * May include execution details, error information, etc.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * AuditContext: The context for starting a new audit trail.
 */
export interface AuditContext {
  /**
   * The shop ID for this execution.
   */
  readonly shop_id: string;

  /**
   * The conversation ID for this execution.
   */
  readonly conversation_id: string;

  /**
   * The ReplyPlan ID for this execution.
   */
  readonly plan_id: string;

  /**
   * Optional metadata for the audit.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Helper function to start a new audit trail.
 *
 * @param context - The audit context.
 * @returns A new AuditCorrelation with status IN_PROGRESS.
 */
export function startAudit(context: AuditContext): AuditCorrelation {
  return {
    audit_id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    shop_id: context.shop_id,
    conversation_id: context.conversation_id,
    plan_id: context.plan_id,
    status: "IN_PROGRESS",
    created_at: new Date().toISOString(),
    verifications: [],
    metadata: context.metadata,
  };
}

/**
 * Helper function to record a confirmation in an audit trail.
 *
 * @param audit - The audit trail.
 * @param confirmation - The confirmation binding to record.
 * @returns A new AuditCorrelation with the confirmation recorded.
 */
export function recordConfirmation(
  audit: AuditCorrelation,
  confirmation: ConfirmationBinding,
): AuditCorrelation {
  return {
    ...audit,
    confirmation,
  };
}

/**
 * Helper function to record a verification in an audit trail.
 *
 * @param audit - The audit trail.
 * @param verification - The verification record to record.
 * @returns A new AuditCorrelation with the verification recorded.
 */
export function recordVerification(
  audit: AuditCorrelation,
  verification: VerificationRecord,
): AuditCorrelation {
  return {
    ...audit,
    verifications: [...audit.verifications, verification],
  };
}

/**
 * Helper function to record an outcome in an audit trail.
 *
 * @param audit - The audit trail.
 * @param outcome - The transport outcome to record.
 * @returns A new AuditCorrelation with the outcome recorded.
 */
export function recordOutcome(
  audit: AuditCorrelation,
  outcome: TransportOutcome,
): AuditCorrelation {
  return {
    ...audit,
    outcome,
  };
}

/**
 * Helper function to record a notification in an audit trail.
 *
 * @param audit - The audit trail.
 * @param notification - The desktop notification to record.
 * @returns A new AuditCorrelation with the notification recorded.
 */
export function recordNotification(
  audit: AuditCorrelation,
  notification: DesktopNotification,
): AuditCorrelation {
  return {
    ...audit,
    notification,
  };
}

/**
 * Helper function to complete an audit trail.
 *
 * @param audit - The audit trail to complete.
 * @returns A new AuditCorrelation with status COMPLETED.
 */
export function completeAudit(audit: AuditCorrelation): AuditCorrelation {
  return {
    ...audit,
    status: "COMPLETED",
    completed_at: new Date().toISOString(),
  };
}

/**
 * Helper function to mark an audit trail as failed.
 *
 * @param audit - The audit trail to mark as failed.
 * @param reason - Optional reason for failure.
 * @returns A new AuditCorrelation with status FAILED.
 */
export function failAudit(audit: AuditCorrelation, reason?: string): AuditCorrelation {
  return {
    ...audit,
    status: "FAILED",
    completed_at: new Date().toISOString(),
    metadata: {
      ...audit.metadata,
      failure_reason: reason,
    },
  };
}

/**
 * Type guard: Check if an audit trail is complete.
 *
 * @param audit - The audit trail to check.
 * @returns true if the audit is COMPLETED.
 */
export function isAuditCompleted(audit: AuditCorrelation): boolean {
  return audit.status === "COMPLETED";
}

/**
 * Type guard: Check if an audit trail has a confirmation.
 *
 * @param audit - The audit trail to check.
 * @returns true if the audit has a confirmation.
 */
export function hasConfirmation(audit: AuditCorrelation): boolean {
  return audit.confirmation !== undefined;
}

/**
 * Type guard: Check if an audit trail has an outcome.
 *
 * @param audit - The audit trail to check.
 * @returns true if the audit has an outcome.
 */
export function hasOutcome(audit: AuditCorrelation): boolean {
  return audit.outcome !== undefined;
}

/**
 * Type guard: Check if an audit trail has a notification.
 *
 * @param audit - The audit trail to check.
 * @returns true if the audit has a notification.
 */
export function hasNotification(audit: AuditCorrelation): boolean {
  return audit.notification !== undefined;
}

/**
 * Validate that an audit trail is complete.
 *
 * @param audit - The audit trail to validate.
 * @returns true if the audit is complete and has all required events.
 */
export function isAuditComplete(audit: AuditCorrelation): boolean {
  return (
    audit.status === "COMPLETED" &&
    audit.verifications.length > 0 &&
    audit.outcome !== undefined &&
    audit.notification !== undefined
  );
}
