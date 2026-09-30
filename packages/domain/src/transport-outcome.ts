/**
 * Transport Outcome Domain (SHEEP-311).
 *
 * Governance basis:
 * - REPLY_AND_ACTION_SAFETY §6: Attempt and UNKNOWN Semantics.
 * - PLATFORM_ADAPTER_CONTRACT §1: Adapter returns typed execution outcomes.
 * - PDD_MVP_V1.md: HUMAN_CONFIRM mode requires typed outcomes.
 *
 * Key invariants:
 * - TransportOutcome is the typed result of a platform send attempt.
 * - Three outcome types: ACKNOWLEDGED, REJECTED, UNKNOWN.
 * - UNKNOWN outcomes MUST include a reason and context.
 * - UNKNOWN outcomes stop automatic execution and surface to human.
 * - All outcomes are immutable and auditable.
 *
 * Owner SHEEP-311 decisions:
 * D1: TransportOutcome is a structured, type-safe result.
 * D2: UNKNOWN outcomes are explicit and include reason/context.
 * D3: Outcomes are immutable and auditable.
 */

/**
 * TransportOutcomeType: The three possible outcomes of a platform send.
 *
 * - ACKNOWLEDGED: Platform confirmed message received.
 * - REJECTED: Platform explicitly rejected the message.
 * - UNKNOWN: Cannot determine message state (MUST stop execution, preserve reason, surface to human).
 */
export type TransportOutcomeType = "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN";

/**
 * TransportOutcome: The typed result of a platform send attempt.
 *
 * This interface represents the outcome of attempting to send a message
 * to a platform (e.g., PDD). The outcome determines next steps:
 * - ACKNOWLEDGED: Success, can proceed.
 * - REJECTED: Platform refused, log and notify.
 * - UNKNOWN: Cannot determine, MUST stop and surface to human.
 *
 * Usage:
 * ```typescript
 * const outcome: TransportOutcome = {
 *   outcome_type: "ACKNOWLEDGED",
 *   attempt_id: "attempt-123",
 *   platform_message_id: "msg-456",
 *   acknowledged_at: "2026-09-30T10:00:00Z",
 * };
 * ```
 */
export interface TransportOutcome {
  /**
   * The type of outcome.
   * Determines the execution path and next steps.
   */
  readonly outcome_type: TransportOutcomeType;

  /**
   * Unique identifier for this send attempt.
   * Used for audit correlation and idempotency.
   */
  readonly attempt_id: string;

  /**
   * Platform-assigned message ID (if available).
   * Present for ACKNOWLEDGED outcomes, optional for others.
   */
  readonly platform_message_id?: string;

  /**
   * ISO 8601 timestamp when the platform acknowledged the message.
   * Required for ACKNOWLEDGED outcomes.
   */
  readonly acknowledged_at?: string;

  /**
   * ISO 8601 timestamp when the platform rejected the message.
   * Required for REJECTED outcomes.
   */
  readonly rejected_at?: string;

  /**
   * Human-readable reason for UNKNOWN outcome.
   * REQUIRED for UNKNOWN outcomes. Explains why the state is unknown.
   * Example: "Network timeout during send", "Platform returned ambiguous response"
   */
  readonly unknown_reason?: string;

  /**
   * Additional context for UNKNOWN outcome.
   * REQUIRED for UNKNOWN outcomes. May include error details, partial responses, etc.
   * Used for debugging and audit.
   */
  readonly unknown_context?: unknown;

  /**
   * Raw platform response (if available).
   * Useful for debugging and audit. May contain platform-specific details.
   */
  readonly raw_response?: unknown;

  /**
   * ISO 8601 timestamp when this outcome was created.
   * Used for audit and traceability.
   */
  readonly created_at: string;
}

/**
 * UnknownOutcome: A TransportOutcome with outcome_type = "UNKNOWN".
 *
 * This is a refined type that enforces the requirement that UNKNOWN
 * outcomes MUST include a reason and context. This provides compile-time
 * safety for UNKNOWN handling.
 *
 * Usage:
 * ```typescript
 * const unknown: UnknownOutcome = {
 *   outcome_type: "UNKNOWN",
 *   attempt_id: "attempt-123",
 *   unknown_reason: "Network timeout during send",
 *   unknown_context: { error: "ETIMEDOUT", duration_ms: 5000 },
 *   created_at: "2026-09-30T10:00:00Z",
 * };
 * ```
 */
export interface UnknownOutcome extends TransportOutcome {
  readonly outcome_type: "UNKNOWN";
  readonly unknown_reason: string; // Required
  readonly unknown_context: unknown; // Required
}

/**
 * AcknowledgedOutcome: A TransportOutcome with outcome_type = "ACKNOWLEDGED".
 *
 * This is a refined type for successful outcomes.
 */
export interface AcknowledgedOutcome extends TransportOutcome {
  readonly outcome_type: "ACKNOWLEDGED";
  readonly platform_message_id: string; // Required
  readonly acknowledged_at: string; // Required
}

/**
 * RejectedOutcome: A TransportOutcome with outcome_type = "REJECTED".
 *
 * This is a refined type for rejected outcomes.
 */
export interface RejectedOutcome extends TransportOutcome {
  readonly outcome_type: "REJECTED";
  readonly rejected_at: string; // Required
}

/**
 * Helper function to create an ACKNOWLEDGED outcome.
 *
 * @param attemptId - Unique attempt identifier
 * @param platformMessageId - Platform-assigned message ID
 * @param acknowledgedAt - ISO 8601 timestamp (defaults to now)
 * @returns AcknowledgedOutcome
 *
 * @example
 * ```typescript
 * const outcome = createAcknowledgedOutcome("attempt-123", "msg-456");
 * // outcome.outcome_type === "ACKNOWLEDGED"
 * ```
 */
export function createAcknowledgedOutcome(
  attemptId: string,
  platformMessageId: string,
  acknowledgedAt?: string,
): AcknowledgedOutcome {
  return {
    outcome_type: "ACKNOWLEDGED",
    attempt_id: attemptId,
    platform_message_id: platformMessageId,
    acknowledged_at: acknowledgedAt ?? new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

/**
 * Helper function to create a REJECTED outcome.
 *
 * @param attemptId - Unique attempt identifier
 * @param rejectedAt - ISO 8601 timestamp (defaults to now)
 * @param rawResponse - Optional raw platform response
 * @returns RejectedOutcome
 *
 * @example
 * ```typescript
 * const outcome = createRejectedOutcome("attempt-123");
 * // outcome.outcome_type === "REJECTED"
 * ```
 */
export function createRejectedOutcome(
  attemptId: string,
  rejectedAt?: string,
  rawResponse?: unknown,
): RejectedOutcome {
  return {
    outcome_type: "REJECTED",
    attempt_id: attemptId,
    rejected_at: rejectedAt ?? new Date().toISOString(),
    raw_response: rawResponse,
    created_at: new Date().toISOString(),
  };
}

/**
 * Helper function to create an UNKNOWN outcome.
 *
 * IMPORTANT: UNKNOWN outcomes MUST include a reason and context.
 * This is enforced by the type system.
 *
 * @param attemptId - Unique attempt identifier
 * @param reason - Human-readable reason for unknown state (REQUIRED)
 * @param context - Additional context for debugging (REQUIRED)
 * @param rawResponse - Optional raw platform response
 * @returns UnknownOutcome
 *
 * @example
 * ```typescript
 * const outcome = createUnknownOutcome(
 *   "attempt-123",
 *   "Network timeout during send",
 *   { error: "ETIMEDOUT", duration_ms: 5000 }
 * );
 * // outcome.outcome_type === "UNKNOWN"
 * ```
 */
export function createUnknownOutcome(
  attemptId: string,
  reason: string,
  context: unknown,
  rawResponse?: unknown,
): UnknownOutcome {
  return {
    outcome_type: "UNKNOWN",
    attempt_id: attemptId,
    unknown_reason: reason,
    unknown_context: context,
    raw_response: rawResponse,
    created_at: new Date().toISOString(),
  };
}

/**
 * Type guard: Check if a TransportOutcome is an UnknownOutcome.
 *
 * @param outcome - The outcome to check
 * @returns true if the outcome is UNKNOWN
 *
 * @example
 * ```typescript
 * if (isUnknownOutcome(outcome)) {
 *   // TypeScript knows outcome is UnknownOutcome here
 *   console.log(outcome.unknown_reason);
 * }
 * ```
 */
export function isUnknownOutcome(outcome: TransportOutcome): outcome is UnknownOutcome {
  return outcome.outcome_type === "UNKNOWN";
}

/**
 * Type guard: Check if a TransportOutcome is an AcknowledgedOutcome.
 *
 * @param outcome - The outcome to check
 * @returns true if the outcome is ACKNOWLEDGED
 */
export function isAcknowledgedOutcome(outcome: TransportOutcome): outcome is AcknowledgedOutcome {
  return outcome.outcome_type === "ACKNOWLEDGED";
}

/**
 * Type guard: Check if a TransportOutcome is a RejectedOutcome.
 *
 * @param outcome - The outcome to check
 * @returns true if the outcome is REJECTED
 */
export function isRejectedOutcome(outcome: TransportOutcome): outcome is RejectedOutcome {
  return outcome.outcome_type === "REJECTED";
}
