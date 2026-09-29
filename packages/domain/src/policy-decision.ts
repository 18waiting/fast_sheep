/**
 * Policy Decision Domain (SHEEP-308).
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy decision is required before execution.
 * - PDD_MVP_V1.md §3: RolloutMode definitions (OFF, SHADOW, HUMAN_CONFIRM, AUTO).
 *
 * Key invariants:
 * - PolicyDecision is the output of PolicyEngine evaluation.
 * - It determines whether and how a ReplyPlan can be executed.
 * - blocking_issues prevent execution entirely.
 * - warnings are logged but do not prevent execution.
 * - rollout_mode determines the execution path (OFF/SHADOW/HUMAN_CONFIRM/AUTO).
 * - AI confidence alone cannot satisfy authorization.
 *
 * Owner SHEEP-308 decisions:
 * D1: PolicyDecision is a structured, type-safe decision result.
 * D2: blocking_issues are deterministic and explicit.
 * D3: rollout_mode is resolved from configuration and evaluation context.
 *
 * **Contract Schema Types — Not Domain Layer Types**
 *
 * These TypeScript types mirror the JSON Schema definitions in
 * `resources/contracts/schemas/domain/policy-decision.schema.json`.
 * They use flat strings with snake_case naming.
 */

import type { RolloutMode } from "./context-envelope.js";

/**
 * PolicyDecision: The output of PolicyEngine evaluation.
 *
 * This interface represents the result of evaluating a ReplyPlan against
 * policy rules, identity validation, fact verification, and configuration.
 *
 * The decision determines:
 * - Whether the ReplyPlan can be executed (allowed)
 * - How it should be executed (rollout_mode)
 * - Whether human confirmation is required (requires_confirmation)
 * - What issues or warnings were found during evaluation
 *
 * Usage:
 * ```typescript
 * const decision: PolicyDecision = {
 *   allowed: true,
 *   rollout_mode: "HUMAN_CONFIRM",
 *   requires_confirmation: true,
 *   confirmation_reason: "Default safety mode",
 *   reasons: ["IdentityLock validated", "Facts verified"],
 *   warnings: ["Low confidence inference detected"],
 *   blocking_issues: [],
 *   evaluated_at: "2026-09-29T10:00:00Z",
 *   policy_version: "1.0.0",
 * };
 * ```
 */
export interface PolicyDecision {
  /**
   * Whether the ReplyPlan is allowed to proceed.
   * false if any blocking_issues are present.
   */
  readonly allowed: boolean;

  /**
   * The resolved RolloutMode for this ReplyPlan.
   * - OFF: No AI reply execution
   * - SHADOW: Generate reply but do not send (audit/testing)
   * - HUMAN_CONFIRM: Requires human confirmation before execution
   * - AUTO: May execute automatically (capability-gated, MVP unauthorized)
   */
  readonly rollout_mode: RolloutMode;

  /**
   * Whether human confirmation is required before execution.
   * Typically true when rollout_mode is HUMAN_CONFIRM.
   */
  readonly requires_confirmation: boolean;

  /**
   * Human-readable reason for the confirmation requirement.
   * Optional, but recommended when requires_confirmation is true.
   */
  readonly confirmation_reason?: string;

  /**
   * List of reasons supporting this decision.
   * Informational, does not affect execution.
   * Example: ["IdentityLock validated", "Facts verified", "Risk level: low"]
   */
  readonly reasons: readonly string[];

  /**
   * List of warnings detected during evaluation.
   * Warnings are logged but do not prevent execution.
   * Example: ["Low confidence inference detected", "Fact freshness > 24h"]
   */
  readonly warnings: readonly string[];

  /**
   * List of blocking issues that prevent execution.
   * If non-empty, allowed must be false.
   * Example: ["IdentityLock validation failed", "Blocking unknown: missing customer identity"]
   */
  readonly blocking_issues: readonly string[];

  /**
   * ISO 8601 timestamp when this decision was evaluated.
   * Used for audit and traceability.
   */
  readonly evaluated_at: string;

  /**
   * Version of the policy configuration used for evaluation.
   * Used for audit and traceability.
   * Example: "1.0.0", "shop:s1:v2"
   */
  readonly policy_version: string;
}

/**
 * Helper function to create a blocked PolicyDecision.
 *
 * Use this when evaluation encounters blocking issues that prevent execution.
 *
 * @param blockingIssues - List of blocking issues
 * @param reasons - Optional list of reasons
 * @param policyVersion - Policy version string
 * @returns PolicyDecision with allowed=false
 *
 * @example
 * ```typescript
 * const decision = createBlockedDecision(
 *   ["IdentityLock validation failed"],
 *   ["IdentityLock checked"],
 *   "1.0.0"
 * );
 * // decision.allowed === false
 * // decision.rollout_mode === "OFF"
 * ```
 */
export function createBlockedDecision(
  blockingIssues: readonly string[],
  reasons: readonly string[] = [],
  policyVersion: string = "1.0.0",
): PolicyDecision {
  return {
    allowed: false,
    rollout_mode: "OFF",
    requires_confirmation: false,
    reasons,
    warnings: [],
    blocking_issues: blockingIssues,
    evaluated_at: new Date().toISOString(),
    policy_version: policyVersion,
  };
}

/**
 * Helper function to create a PolicyDecision with a specific RolloutMode.
 *
 * Use this when evaluation succeeds and a specific mode should be used.
 *
 * @param mode - The RolloutMode to use
 * @param reasons - Optional list of reasons
 * @param warnings - Optional list of warnings
 * @param policyVersion - Policy version string
 * @param confirmationReason - Optional confirmation reason (for HUMAN_CONFIRM)
 * @returns PolicyDecision with the specified mode
 *
 * @example
 * ```typescript
 * const decision = createModeDecision(
 *   "HUMAN_CONFIRM",
 *   ["IdentityLock validated", "Facts verified"],
 *   ["Low confidence inference"],
 *   "1.0.0",
 *   "Default safety mode"
 * );
 * // decision.allowed === true
 * // decision.rollout_mode === "HUMAN_CONFIRM"
 * // decision.requires_confirmation === true
 * ```
 */
export function createModeDecision(
  mode: RolloutMode,
  reasons: readonly string[] = [],
  warnings: readonly string[] = [],
  policyVersion: string = "1.0.0",
  confirmationReason?: string,
): PolicyDecision {
  const requiresConfirmation = mode === "HUMAN_CONFIRM";

  return {
    allowed: true,
    rollout_mode: mode,
    requires_confirmation: requiresConfirmation,
    confirmation_reason: confirmationReason,
    reasons,
    warnings,
    blocking_issues: [],
    evaluated_at: new Date().toISOString(),
    policy_version: policyVersion,
  };
}
