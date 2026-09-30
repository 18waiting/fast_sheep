/**
 * Verification Record Domain (SHEEP-311).
 *
 * Governance basis:
 * - REPLY_AND_ACTION_SAFETY: Pre-execution verification is required.
 * - PDD_MVP_V1.md: Verification must be recorded for audit.
 *
 * Key invariants:
 * - VerificationRecord is the immutable record of a pre-execution verification.
 * - Multiple verification types: identity_lock, wrong_target, binding, reply_plan.
 * - Verification results are auditable and traceable.
 * - Failed verifications prevent execution.
 *
 * Owner SHEEP-311 decisions:
 * D1: VerificationRecord is a structured, type-safe verification result.
 * D2: Verification types are explicit and extensible.
 * D3: Verification records are immutable and auditable.
 */

/**
 * VerificationType: The type of verification performed.
 *
 * - IDENTITY_LOCK: Validates IdentityLock completeness and validity.
 * - WRONG_TARGET: Validates target correctness (customerUid, etc.).
 * - BINDING: Validates all 6 bindings (shop, platform, conversation, trigger, session, document).
 * - REPLY_PLAN: Validates ReplyPlan structure and content.
 * - CONFIRMATION: Validates human confirmation binding.
 */
export type VerificationType =
  | "IDENTITY_LOCK"
  | "WRONG_TARGET"
  | "BINDING"
  | "REPLY_PLAN"
  | "CONFIRMATION";

/**
 * VerificationFailure: A specific failure in verification.
 */
export interface VerificationFailure {
  /**
   * The field that failed verification.
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
 * VerificationRecord: The immutable record of a pre-execution verification.
 *
 * This interface represents the result of verifying a specific aspect
 * of the execution context before sending a message.
 *
 * Usage:
 * ```typescript
 * const record: VerificationRecord = {
 *   verification_id: "ver-123",
 *   audit_id: "audit-456",
 *   verification_type: "IDENTITY_LOCK",
 *   verified_at: "2026-09-30T10:00:00Z",
 *   passed: true,
 * };
 * ```
 */
export interface VerificationRecord {
  /**
   * Unique identifier for this verification.
   * Used for audit correlation.
   */
  readonly verification_id: string;

  /**
   * The audit ID this verification belongs to.
   * Links verification to the overall execution audit trail.
   */
  readonly audit_id: string;

  /**
   * The type of verification performed.
   */
  readonly verification_type: VerificationType;

  /**
   * ISO 8601 timestamp when the verification was performed.
   */
  readonly verified_at: string;

  /**
   * Whether the verification passed.
   * false means execution should be blocked.
   */
  readonly passed: boolean;

  /**
   * List of verification failures (if any).
   * Empty if passed is true.
   */
  readonly failures?: readonly VerificationFailure[];

  /**
   * Optional metadata for additional context.
   * May include verification details, configuration, etc.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Helper function to create a passed verification record.
 *
 * @param auditId - The audit ID this verification belongs to.
 * @param verificationType - The type of verification.
 * @param metadata - Optional metadata.
 * @returns A new VerificationRecord with passed=true.
 */
export function createPassedVerification(
  auditId: string,
  verificationType: VerificationType,
  metadata?: Record<string, unknown>,
): VerificationRecord {
  return {
    verification_id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    verification_type: verificationType,
    verified_at: new Date().toISOString(),
    passed: true,
    metadata,
  };
}

/**
 * Helper function to create a failed verification record.
 *
 * @param auditId - The audit ID this verification belongs to.
 * @param verificationType - The type of verification.
 * @param failures - List of verification failures.
 * @param metadata - Optional metadata.
 * @returns A new VerificationRecord with passed=false.
 */
export function createFailedVerification(
  auditId: string,
  verificationType: VerificationType,
  failures: readonly VerificationFailure[],
  metadata?: Record<string, unknown>,
): VerificationRecord {
  return {
    verification_id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audit_id: auditId,
    verification_type: verificationType,
    verified_at: new Date().toISOString(),
    passed: false,
    failures,
    metadata,
  };
}

/**
 * Type guard: Check if a verification record passed.
 *
 * @param record - The verification record to check.
 * @returns true if the verification passed.
 */
export function isVerificationPassed(record: VerificationRecord): boolean {
  return record.passed;
}

/**
 * Type guard: Check if a verification record failed.
 *
 * @param record - The verification record to check.
 * @returns true if the verification failed.
 */
export function isVerificationFailed(record: VerificationRecord): boolean {
  return !record.passed;
}

/**
 * Helper function to create a verification failure.
 *
 * @param field - The field that failed.
 * @param reason - Human-readable reason.
 * @param expected - Expected value (optional).
 * @param actual - Actual value (optional).
 * @returns A new VerificationFailure.
 */
export function createVerificationFailure(
  field: string,
  reason: string,
  expected?: string,
  actual?: string,
): VerificationFailure {
  return {
    field,
    reason,
    expected,
    actual,
  };
}
