/**
 * Desktop Notification Domain (SHEEP-311).
 *
 * Governance basis:
 * - REPLY_AND_ACTION_SAFETY §9: V1 notification target is desktop notification.
 * - PDD_MVP_V1.md: Desktop notification is delivered for execution results.
 *
 * Key invariants:
 * - DesktopNotification is the immutable notification for execution results.
 * - Notifications are linked to audit_id for traceability.
 * - UNKNOWN outcomes MUST surface to human via notification.
 * - Notifications are auditable and traceable.
 *
 * Owner SHEEP-311 decisions:
 * D1: DesktopNotification is a structured, type-safe notification.
 * D2: Notifications are linked to audit trail.
 * D3: UNKNOWN outcomes always trigger notifications.
 */

/**
 * NotificationType: The type of desktop notification.
 *
 * - SEND_ACKNOWLEDGED: Platform confirmed message received.
 * - SEND_REJECTED: Platform explicitly rejected the message.
 * - SEND_UNKNOWN: Cannot determine message state (MUST notify human).
 * - CONFIRMATION_REQUIRED: Human confirmation is required before execution.
 * - VERIFICATION_FAILED: Pre-execution verification failed.
 */
export type NotificationType =
  | "SEND_ACKNOWLEDGED"
  | "SEND_REJECTED"
  | "SEND_UNKNOWN"
  | "CONFIRMATION_REQUIRED"
  | "VERIFICATION_FAILED";

/**
 * NotificationSeverity: The severity level of the notification.
 *
 * - INFO: Informational, no action required.
 * - WARNING: Warning, may need attention.
 * - ERROR: Error, action required.
 * - CRITICAL: Critical, immediate action required.
 */
export type NotificationSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

/**
 * DesktopNotification: The immutable notification for execution results.
 *
 * This interface represents a desktop notification that informs the user
 * about execution results, confirmation requirements, or verification failures.
 *
 * Usage:
 * ```typescript
 * const notification: DesktopNotification = {
 *   notification_id: "notif-123",
 *   audit_id: "audit-456",
 *   notification_type: "SEND_ACKNOWLEDGED",
 *   severity: "INFO",
 *   title: "Message Sent Successfully",
 *   message: "Your reply has been sent to the customer.",
 *   created_at: "2026-09-30T10:00:00Z",
 * };
 * ```
 */
export interface DesktopNotification {
  /**
   * Unique identifier for this notification.
   * Used for tracking and deduplication.
   */
  readonly notification_id: string;

  /**
   * The audit ID this notification belongs to.
   * Links notification to the overall execution audit trail.
   */
  readonly audit_id: string;

  /**
   * The type of notification.
   */
  readonly notification_type: NotificationType;

  /**
   * The severity level of the notification.
   */
  readonly severity: NotificationSeverity;

  /**
   * The title of the notification.
   * Short, concise summary.
   */
  readonly title: string;

  /**
   * The message body of the notification.
   * Detailed description of the event.
   */
  readonly message: string;

  /**
   * ISO 8601 timestamp when the notification was created.
   */
  readonly created_at: string;

  /**
   * Optional metadata for additional context.
   * May include plan_id, error details, etc.
   */
  readonly metadata?: Record<string, unknown>;

  /**
   * Optional action URL or command.
   * May link to a confirmation dialog, error details, etc.
   */
  readonly action?: string;
}

/**
 * Helper function to create a SEND_ACKNOWLEDGED notification.
 *
 * @param auditId - The audit ID.
 * @param title - Notification title.
 * @param message - Notification message.
 * @param metadata - Optional metadata.
 * @returns A new DesktopNotification with severity INFO.
 */
export function createAcknowledgedNotification(
  auditId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): DesktopNotification {
  return {
    notification_id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    notification_type: "SEND_ACKNOWLEDGED",
    severity: "INFO",
    title,
    message,
    created_at: new Date().toISOString(),
    metadata,
  };
}

/**
 * Helper function to create a SEND_REJECTED notification.
 *
 * @param auditId - The audit ID.
 * @param title - Notification title.
 * @param message - Notification message.
 * @param metadata - Optional metadata.
 * @returns A new DesktopNotification with severity WARNING.
 */
export function createRejectedNotification(
  auditId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): DesktopNotification {
  return {
    notification_id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    notification_type: "SEND_REJECTED",
    severity: "WARNING",
    title,
    message,
    created_at: new Date().toISOString(),
    metadata,
  };
}

/**
 * Helper function to create a SEND_UNKNOWN notification.
 *
 * IMPORTANT: UNKNOWN outcomes MUST trigger a notification to surface to human.
 *
 * @param auditId - The audit ID.
 * @param title - Notification title.
 * @param message - Notification message (MUST include unknown reason).
 * @param metadata - Optional metadata (MUST include unknown context).
 * @returns A new DesktopNotification with severity ERROR.
 */
export function createUnknownNotification(
  auditId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): DesktopNotification {
  return {
    notification_id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    notification_type: "SEND_UNKNOWN",
    severity: "ERROR",
    title,
    message,
    created_at: new Date().toISOString(),
    metadata,
  };
}

/**
 * Helper function to create a CONFIRMATION_REQUIRED notification.
 *
 * @param auditId - The audit ID.
 * @param title - Notification title.
 * @param message - Notification message.
 * @param action - Optional action URL or command for confirmation dialog.
 * @param metadata - Optional metadata.
 * @returns A new DesktopNotification with severity WARNING.
 */
export function createConfirmationRequiredNotification(
  auditId: string,
  title: string,
  message: string,
  action?: string,
  metadata?: Record<string, unknown>,
): DesktopNotification {
  return {
    notification_id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    notification_type: "CONFIRMATION_REQUIRED",
    severity: "WARNING",
    title,
    message,
    created_at: new Date().toISOString(),
    action,
    metadata,
  };
}

/**
 * Helper function to create a VERIFICATION_FAILED notification.
 *
 * @param auditId - The audit ID.
 * @param title - Notification title.
 * @param message - Notification message.
 * @param metadata - Optional metadata.
 * @returns A new DesktopNotification with severity ERROR.
 */
export function createVerificationFailedNotification(
  auditId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): DesktopNotification {
  return {
    notification_id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    notification_type: "VERIFICATION_FAILED",
    severity: "ERROR",
    title,
    message,
    created_at: new Date().toISOString(),
    metadata,
  };
}

/**
 * Type guard: Check if a notification is an UNKNOWN outcome notification.
 *
 * @param notification - The notification to check.
 * @returns true if the notification is SEND_UNKNOWN.
 */
export function isUnknownNotification(notification: DesktopNotification): boolean {
  return notification.notification_type === "SEND_UNKNOWN";
}

/**
 * Type guard: Check if a notification requires human action.
 *
 * @param notification - The notification to check.
 * @returns true if the notification requires human action.
 */
export function requiresHumanAction(notification: DesktopNotification): boolean {
  return (
    notification.notification_type === "SEND_UNKNOWN" ||
    notification.notification_type === "CONFIRMATION_REQUIRED" ||
    notification.notification_type === "VERIFICATION_FAILED"
  );
}
