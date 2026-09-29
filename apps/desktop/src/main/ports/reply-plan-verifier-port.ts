/**
 * ReplyPlan Verifier Port (SHEEP-306, P2-8a).
 *
 * Purpose: Define the port interface for pre-execution ReplyPlan verification.
 * Verifier ensures ReplyPlan safety and correctness before send.
 *
 * Governance basis:
 * - Master §5: AI output must be verified before execution.
 * - DEC-SHEEP-306: ReplyPlan verification is structural, not optional.
 * - REPLY_AND_ACTION_SAFETY.md: Verification requirements are explicit.
 *
 * Key invariants:
 * - Port is implementation-agnostic (could be sync/async, local/remote).
 * - Verification results are explicit (errors + warnings).
 * - Blocking errors prevent execution; warnings are informational.
 * - Verification is deterministic (no AI-based judgment).
 *
 * Owner SHEEP-306 decisions:
 * D1: Verifier is a port, not a service (allows multiple implementations).
 * D2: Verification results separate errors (blocking) from warnings (non-blocking).
 * D3: MVP verification covers IdentityLock + Fact existence + Unknown blocking.
 */

import type { ReplyPlan } from "@fastwork/domain";

/**
 * Verification error category.
 * Aligns with ReplyPlan.RequiredVerification.category.
 */
export type VerificationErrorCategory =
  | "identity_lock"           // IdentityLock validation failed
  | "fact_freshness"          // Fact reference validation failed
  | "unknown_blocking"        // Blocking unknown detected
  | "policy_violation";       // Policy metadata violation

/**
 * Verification error severity.
 * - error: Blocking, prevents execution.
 * - warning: Non-blocking, informational.
 */
export type VerificationErrorSeverity = "error" | "warning";

/**
 * A single verification error or warning.
 */
export interface VerificationError {
  readonly error_id: string;
  readonly category: VerificationErrorCategory;
  readonly severity: VerificationErrorSeverity;
  readonly message: string;
  readonly blocking: boolean;
}

/**
 * Result of ReplyPlan verification.
 */
export interface VerificationResult {
  readonly ok: boolean;                    // true if no blocking errors
  readonly plan_id: string;                // Reference to verified ReplyPlan
  readonly errors: readonly VerificationError[];      // Blocking errors
  readonly warnings: readonly VerificationError[];    // Non-blocking warnings
  readonly verified_at: string;            // ISO 8601 datetime
}

/**
 * ReplyPlan Verifier Port.
 *
 * This is the abstraction boundary for ReplyPlan verification.
 * Implementation (P2-8d) orchestrates IdentityLock, Fact, and Unknown verifiers.
 *
 * Usage in integration:
 * ```typescript
 * const verifier: ReplyPlanVerifierPort = ...; // injected
 * const result = await verifier.verify(replyPlan);
 * if (!result.ok) {
 *   // Handle blocking errors (e.g., reject send, request human review)
 *   console.error("Verification failed:", result.errors);
 * } else {
 *   // Proceed with send (or log warnings)
 *   if (result.warnings.length > 0) {
 *     console.warn("Verification warnings:", result.warnings);
 *   }
 * }
 * ```
 */
export interface ReplyPlanVerifierPort {
  /**
   * Verify a ReplyPlan before execution.
   *
   * MVP verification scope:
   * - IdentityLock completeness and validity.
   * - Fact reference existence in authoritative_facts.
   * - Blocking unknown detection.
   *
   * Future (Phase 9):
   * - Fact freshness (timestamp validation).
   * - Inference confidence validation.
   * - Cross-shop consistency checks.
   *
   * @param plan - The ReplyPlan to verify
   * @returns Verification result with errors and warnings
   */
  verify(plan: ReplyPlan): Promise<VerificationResult>;
}
