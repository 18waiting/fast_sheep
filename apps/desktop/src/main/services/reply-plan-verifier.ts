/**
 * ReplyPlan Verifier (SHEEP-306, P2-8d).
 *
 * Purpose: Main entry point for ReplyPlan verification.
 * Orchestrates IdentityLock, Fact, and Unknown verifiers.
 *
 * Governance basis:
 * - Master §5: AI output must be verified before execution.
 * - DEC-SHEEP-306: ReplyPlan verification is structural, not optional.
 * - REPLY_AND_ACTION_SAFETY.md: Verification requirements are explicit.
 *
 * Key invariants:
 * - Implements ReplyPlanVerifierPort interface.
 * - Orchestrates sub-verifiers (IdentityLock, Fact, Unknown).
 * - Aggregates errors and warnings.
 * - Does NOT modify ReplyPlan (read-only verification).
 * - Does NOT implement Inference verifier (MVP simplification).
 *
 * Owner SHEEP-306 decisions:
 * D1: Verifier is a service class implementing Port interface.
 * D2: MVP verification covers IdentityLock + Fact existence + Unknown blocking.
 * D3: Verification is deterministic (no AI-based judgment).
 */

import type { ReplyPlan, AuthoritativeFacts } from "@fastwork/domain";
import type {
  ReplyPlanVerifierPort,
  VerificationResult,
  VerificationError,
} from "../ports/reply-plan-verifier-port.js";
import { verifyIdentityLock } from "./identity-lock-verifier.js";
import { verifyFactFreshness } from "./fact-freshness-verifier.js";

/**
 * ReplyPlan Verifier dependencies.
 *
 * MVP: Verifier needs access to AuthoritativeFacts from ContextEnvelope.
 * In production, this would be injected or retrieved from a cache.
 */
export interface ReplyPlanVerifierDeps {
  /**
   * Retrieve AuthoritativeFacts for a given envelope_ref.
   * MVP: Returns facts from ContextEnvelope that generated this ReplyPlan.
   */
  readonly getFactsForEnvelope: (envelopeRef: string) => Promise<AuthoritativeFacts | undefined>;
}

/**
 * ReplyPlan Verifier implementation.
 *
 * Orchestrates sub-verifiers and aggregates results.
 *
 * Usage:
 * ```typescript
 * const verifier = new ReplyPlanVerifier({
 *   getFactsForEnvelope: async (envelopeRef) => {
 *     // Retrieve facts from ContextEnvelope cache or database
 *     return envelope.authoritative_facts;
 *   },
 * });
 *
 * const result = await verifier.verify(replyPlan);
 * if (!result.ok) {
 *   console.error("Verification failed:", result.errors);
 * }
 * ```
 */
export class ReplyPlanVerifier implements ReplyPlanVerifierPort {
  constructor(private readonly deps: ReplyPlanVerifierDeps) {}

  /**
   * Verify a ReplyPlan before execution.
   *
   * Verification steps:
   * 1. Verify IdentityLock completeness and validity.
   * 2. Verify fact references exist in authoritative_facts.
   * 3. Check for blocking unknowns.
   * 4. Aggregate errors and warnings.
   *
   * @param plan - The ReplyPlan to verify
   * @returns Verification result with errors and warnings
   */
  async verify(plan: ReplyPlan): Promise<VerificationResult> {
    const errors: VerificationError[] = [];
    const warnings: VerificationError[] = [];

    // Step 1: Verify IdentityLock
    const identityResult = verifyIdentityLock(plan.identity_lock);
    if (!identityResult.ok) {
      errors.push(...identityResult.errors);
    }

    // Step 2: Verify fact freshness
    const facts = await this.deps.getFactsForEnvelope(plan.envelope_ref);
    const factResult = verifyFactFreshness(plan, facts);
    if (!factResult.ok) {
      errors.push(...factResult.errors);
    }

    // Step 3: Check blocking unknowns
    const blockingUnknowns = plan.unknowns?.filter((u) => u.blocking) ?? [];
    if (blockingUnknowns.length > 0) {
      errors.push({
        error_id: "blocking_unknowns_detected",
        category: "unknown_blocking",
        severity: "error",
        message: `ReplyPlan has ${blockingUnknowns.length} blocking unknown(s): ${blockingUnknowns.map((u) => u.unknown_id).join(", ")}`,
        blocking: true,
      });
    }

    // Step 4: Check non-blocking unknowns (warnings)
    const nonBlockingUnknowns = plan.unknowns?.filter((u) => !u.blocking) ?? [];
    for (const unknown of nonBlockingUnknowns) {
      warnings.push({
        error_id: `unknown_${unknown.unknown_id}`,
        category: "unknown_blocking",
        severity: "warning",
        message: `Non-blocking unknown: ${unknown.description}`,
        blocking: false,
      });
    }

    return {
      ok: errors.length === 0,
      plan_id: plan.plan_id,
      errors,
      warnings,
      verified_at: new Date().toISOString(),
    };
  }
}

/**
 * Factory function for creating a ReplyPlanVerifier.
 *
 * @param deps - Verifier dependencies
 * @returns A new ReplyPlanVerifier instance
 */
export function createReplyPlanVerifier(deps: ReplyPlanVerifierDeps): ReplyPlanVerifierPort {
  return new ReplyPlanVerifier(deps);
}
