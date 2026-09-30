/**
 * Confirmation Binding Domain (SHEEP-311).
 *
 * Governance basis:
 * - REPLY_AND_ACTION_SAFETY §8: Human confirmation must bind to IdentityLock, ReplyPlan, target resource, policy version, and session evidence.
 * - PDD_MVP_V1.md: HUMAN_CONFIRM mode requires human confirmation before execution.
 *
 * Key invariants:
 * - ConfirmationBinding is the immutable record of human confirmation.
 * - A confirmation binds to a specific ReplyPlan and IdentityLock.
 * - A confirmation for one target must not authorize a different target.
 * - Confirmations are time-bounded and can expire.
 * - Confirmations are auditable and traceable.
 *
 * Owner SHEEP-311 decisions:
 * D1: ConfirmationBinding is a structured, type-safe confirmation record.
 * D2: Confirmations are bound to specific plan_id and identity_lock.
 * D3: Confirmations are time-bounded and auditable.
 */

import type { ContractIdentityLock } from "./context-envelope.js";

/**
 * ConfirmationStatus: The status of a confirmation request.
 *
 * - PENDING: Awaiting human confirmation.
 * - CONFIRMED: Human has confirmed.
 * - REJECTED: Human has rejected.
 * - EXPIRED: Confirmation request has expired.
 * - SUPERSEDED: Superseded by a newer confirmation request.
 */
export type ConfirmationStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";

/**
 * ConfirmationBinding: The immutable record of human confirmation.
 *
 * This interface represents a human's confirmation to execute a specific ReplyPlan
 * for a specific IdentityLock. The binding is immutable and auditable.
 *
 * Usage:
 * ```typescript
 * const binding: ConfirmationBinding = {
 *   confirmation_id: "conf-123",
 *   plan_id: "plan-456",
 *   identity_lock: identityLock,
 *   policy_version: "1.0.0",
 *   confirmed_at: "2026-09-30T10:00:00Z",
 *   confirmed_by: "user-789",
 *   confirmation_hash: "sha256-abc...",
 * };
 * ```
 */
export interface ConfirmationBinding {
  /**
   * Unique identifier for this confirmation.
   * Used for audit correlation and idempotency.
   */
  readonly confirmation_id: string;

  /**
   * The ID of the ReplyPlan being confirmed.
   * A confirmation for one plan must not authorize a different plan.
   */
  readonly plan_id: string;

  /**
   * The IdentityLock scope for this confirmation.
   * A confirmation for one target must not authorize a different target.
   */
  readonly identity_lock: ContractIdentityLock;

  /**
   * The policy version used for evaluation.
   * Ensures the confirmation is valid for the policy version at the time.
   */
  readonly policy_version: string;

  /**
   * ISO 8601 timestamp when the confirmation was made.
   * Used for audit and time-bounded validation.
   */
  readonly confirmed_at: string;

  /**
   * The user ID of the person who confirmed.
   * Used for audit and accountability.
   */
  readonly confirmed_by: string;

  /**
   * Hash of the confirmation contents for integrity verification.
   * Ensures the confirmation has not been tampered with.
   * Format: "sha256-<hash>" or similar.
   */
  readonly confirmation_hash: string;

  /**
   * Optional expiration time (ISO 8601).
   * If present, the confirmation expires after this time.
   */
  readonly expires_at?: string;

  /**
   * Optional metadata for additional context.
   * May include UI state, user notes, etc.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * ConfirmationRequest: A request for human confirmation.
 *
 * This interface represents a pending confirmation request that awaits
 * human action (confirm or reject).
 */
export interface ConfirmationRequest {
  /**
   * Unique identifier for this confirmation request.
   */
  readonly confirmation_id: string;

  /**
   * The ID of the ReplyPlan being requested for confirmation.
   */
  readonly plan_id: string;

  /**
   * The IdentityLock scope for this confirmation request.
   */
  readonly identity_lock: ContractIdentityLock;

  /**
   * The policy version used for evaluation.
   */
  readonly policy_version: string;

  /**
   * ISO 8601 timestamp when the request was created.
   */
  readonly requested_at: string;

  /**
   * Current status of the confirmation request.
   */
  readonly status: ConfirmationStatus;

  /**
   * Optional expiration time (ISO 8601).
   * If present, the request expires after this time.
   */
  readonly expires_at?: string;

  /**
   * Optional reason for the confirmation requirement.
   * Helps the human understand why confirmation is needed.
   */
  readonly confirmation_reason?: string;
}

/**
 * ConfirmationFailure: A specific failure in confirmation validation.
 */
export interface ConfirmationFailure {
  /**
   * The field that failed validation.
   */
  readonly field: string;

  /**
   * Human-readable reason for the failure.
   */
  readonly reason: string;

  /**
   * Expected value (if applicable).
   */
  readonly expected?: string;

  /**
   * Actual value (if applicable).
   */
  readonly actual?: string;
}

/**
 * ConfirmationValidation: The result of validating a confirmation.
 */
export interface ConfirmationValidation {
  /**
   * Whether the confirmation is valid.
   */
  readonly valid: boolean;

  /**
   * List of validation failures (if any).
   */
  readonly failures: readonly ConfirmationFailure[];
}

/**
 * ConfirmationValidator: Validates confirmation bindings.
 *
 * Ensures that a confirmation is valid for the current execution context.
 */
export interface ConfirmationValidator {
  /**
   * Validate a confirmation binding against the current context.
   *
   * @param binding - The confirmation binding to validate.
   * @param context - The current execution context.
   * @returns Validation result with any failures.
   */
  validate(binding: ConfirmationBinding, context: ConfirmationValidationContext): ConfirmationValidation;
}

/**
 * ConfirmationValidationContext: The context for validating a confirmation.
 */
export interface ConfirmationValidationContext {
  /**
   * The expected plan_id for the current execution.
   */
  readonly expected_plan_id: string;

  /**
   * The expected IdentityLock for the current execution.
   */
  readonly expected_identity_lock: ContractIdentityLock;

  /**
   * The current time (ISO 8601) for expiration checks.
   */
  readonly current_time: string;

  /**
   * The expected policy version (if applicable).
   */
  readonly expected_policy_version?: string;
}

/**
 * Helper function to create a confirmation request.
 *
 * @param planId - The ReplyPlan ID.
 * @param identityLock - The IdentityLock scope.
 * @param policyVersion - The policy version.
 * @param expiresAt - Optional expiration time.
 * @param confirmationReason - Optional reason for confirmation.
 * @returns A new ConfirmationRequest with PENDING status.
 */
export function createConfirmationRequest(
  planId: string,
  identityLock: ContractIdentityLock,
  policyVersion: string,
  expiresAt?: string,
  confirmationReason?: string,
): ConfirmationRequest {
  return {
    confirmation_id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    plan_id: planId,
    identity_lock: identityLock,
    policy_version: policyVersion,
    requested_at: new Date().toISOString(),
    status: "PENDING",
    expires_at: expiresAt,
    confirmation_reason: confirmationReason,
  };
}

/**
 * Helper function to create a confirmation binding from a confirmed request.
 *
 * @param request - The confirmation request that was confirmed.
 * @param confirmedBy - The user ID who confirmed.
 * @param confirmationHash - The hash of the confirmation contents.
 * @param metadata - Optional metadata.
 * @returns A new ConfirmationBinding.
 */
export function createConfirmationBinding(
  request: ConfirmationRequest,
  confirmedBy: string,
  confirmationHash: string,
  metadata?: Record<string, unknown>,
): ConfirmationBinding {
  return {
    confirmation_id: request.confirmation_id,
    plan_id: request.plan_id,
    identity_lock: request.identity_lock,
    policy_version: request.policy_version,
    confirmed_at: new Date().toISOString(),
    confirmed_by: confirmedBy,
    confirmation_hash: confirmationHash,
    expires_at: request.expires_at,
    metadata,
  };
}

/**
 * Type guard: Check if a confirmation request is still pending.
 *
 * @param request - The confirmation request to check.
 * @returns true if the request is PENDING.
 */
export function isPendingConfirmation(request: ConfirmationRequest): boolean {
  return request.status === "PENDING";
}

/**
 * Type guard: Check if a confirmation request has been confirmed.
 *
 * @param request - The confirmation request to check.
 * @returns true if the request is CONFIRMED.
 */
export function isConfirmedConfirmation(request: ConfirmationRequest): boolean {
  return request.status === "CONFIRMED";
}

/**
 * Compute a simple hash for confirmation integrity.
 *
 * This is a placeholder implementation. In production, use a proper
 * cryptographic hash function (e.g., SHA-256).
 *
 * @param binding - The confirmation binding to hash.
 * @returns A hash string.
 */
export function computeConfirmationHash(binding: Omit<ConfirmationBinding, "confirmation_hash">): string {
  // Simple hash for demonstration. In production, use crypto.subtle or similar.
  const content = JSON.stringify({
    confirmation_id: binding.confirmation_id,
    plan_id: binding.plan_id,
    identity_lock: binding.identity_lock,
    policy_version: binding.policy_version,
    confirmed_at: binding.confirmed_at,
    confirmed_by: binding.confirmed_by,
  });

  // Simple hash function (not cryptographically secure)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `sha256-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}
