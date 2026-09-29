/**
 * Policy Engine (SHEEP-308).
 *
 * Purpose: Evaluate ReplyPlan against policy rules and return PolicyDecision.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation.
 * - PDD_MVP_V1.md §3: RolloutMode definitions.
 *
 * Key invariants:
 * - Evaluation is deterministic and auditable.
 * - blocking_issues prevent execution entirely.
 * - warnings are logged but do not prevent execution.
 * - AI confidence alone cannot satisfy authorization.
 * - Evaluation does not modify ReplyPlan or ContextEnvelope.
 * - Evaluation does not call AI or transport.
 *
 * Owner SHEEP-308 decisions:
 * D1: MVP implements basic validation (IdentityLock, facts, unknowns).
 * D2: Capability/entitlement check is simplified (always true in MVP).
 * D3: Risk assessment is simplified (based on scene and unknowns).
 */

import type {
  ContextEnvelope,
  ReplyPlan,
  PolicyConfig,
  PolicyDecision,
} from "@fastwork/domain";
import {
  createBlockedDecision,
  createModeDecision,
} from "@fastwork/domain";
import { RolloutModeResolver } from "./rollout-mode-resolver.js";
import type { ResolutionContext } from "./rollout-mode-resolver.js";

/**
 * PolicyEngine: Evaluates ReplyPlan against policy rules.
 *
 * This class is the core of the policy system. It evaluates a ReplyPlan
 * against the ContextEnvelope and PolicyConfig to determine whether and
 * how the ReplyPlan can be executed.
 *
 * Usage:
 * ```typescript
 * const engine = new PolicyEngine();
 * const decision = await engine.evaluate(envelope, replyPlan, config);
 *
 * if (!decision.allowed) {
 *   console.log("Blocked:", decision.blocking_issues);
 * } else {
 *   console.log("Mode:", decision.rollout_mode);
 * }
 * ```
 */
export class PolicyEngine {
  /**
   * Create a new PolicyEngine.
   */
  constructor() {}

  /**
   * Evaluate a ReplyPlan against policy rules.
   *
   * Evaluation order:
   * 1. Validate IdentityLock
   * 2. Validate facts
   * 3. Check blocking unknowns
   * 4. Check capability/entitlement (MVP: always true)
   * 5. Assess risk level
   * 6. Resolve RolloutMode
   * 7. Build PolicyDecision
   *
   * @param envelope - ContextEnvelope containing identity and context
   * @param replyPlan - ReplyPlan to evaluate
   * @param config - Policy configuration hierarchy
   * @returns PolicyDecision with evaluation result
   */
  async evaluate(
    envelope: ContextEnvelope,
    replyPlan: ReplyPlan,
    config: PolicyConfig
  ): Promise<PolicyDecision> {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const blockingIssues: string[] = [];

    // Step 1: Validate IdentityLock
    const identityValid = this.validateIdentityLock(envelope, blockingIssues, reasons);
    if (!identityValid) {
      return createBlockedDecision(
        blockingIssues,
        reasons,
        config.global.default_mode === "OFF" ? "1.0.0" : "1.0.0"
      );
    }

    // Step 2: Validate facts
    this.validateFacts(replyPlan, warnings, reasons);

    // Step 3: Check blocking unknowns
    const hasBlockingUnknowns = this.checkBlockingUnknowns(envelope, blockingIssues, reasons);
    if (hasBlockingUnknowns) {
      return createBlockedDecision(blockingIssues, reasons, "1.0.0");
    }

    // Step 4: Check capability/entitlement (MVP: always true)
    const hasCapability = this.checkCapability(envelope, reasons);
    if (!hasCapability) {
      return createBlockedDecision(
        ["AI capability not enabled for this shop"],
        reasons,
        "1.0.0"
      );
    }

    // Step 5: Assess risk level (blocking unknowns already handled in Step 3)
    const riskLevel = this.assessRiskLevel(envelope, warnings);

    // Step 6: Resolve RolloutMode
    const resolver = new RolloutModeResolver(config);
    const resolutionContext: ResolutionContext = {
      shop_id: envelope.identity_lock.store_id,
      scene: envelope.scene,
      risk_level: riskLevel,
      has_blocking_unknowns: hasBlockingUnknowns,
    };

    const resolution = resolver.resolve(resolutionContext);

    // Step 7: Build PolicyDecision
    reasons.push(`RolloutMode resolved: ${resolution.mode} (source: ${resolution.source})`);
    if (resolution.override_reason) {
      reasons.push(`Override reason: ${resolution.override_reason}`);
    }

    // High risk scenarios force HUMAN_CONFIRM
    let finalMode = resolution.mode;
    if (riskLevel === "high" && finalMode !== "OFF") {
      finalMode = "HUMAN_CONFIRM";
      reasons.push("High risk scenario: forced HUMAN_CONFIRM");
    }

    return createModeDecision(
      finalMode,
      reasons,
      warnings,
      "1.0.0",
      finalMode === "HUMAN_CONFIRM" ? "Policy requires human confirmation" : undefined
    );
  }

  /**
   * Validate IdentityLock completeness and consistency.
   *
   * @param envelope - ContextEnvelope to validate
   * @param blockingIssues - Array to collect blocking issues
   * @param reasons - Array to collect reasons
   * @returns true if valid, false otherwise
   */
  private validateIdentityLock(
    envelope: ContextEnvelope,
    blockingIssues: string[],
    reasons: string[]
  ): boolean {
    const lock = envelope.identity_lock;

    // Check required fields
    if (!lock.merchant_id || lock.merchant_id.trim() === "") {
      blockingIssues.push("IdentityLock missing merchant_id");
      return false;
    }

    if (!lock.store_id || lock.store_id.trim() === "") {
      blockingIssues.push("IdentityLock missing store_id");
      return false;
    }

    if (!lock.platform || lock.platform.trim() === "") {
      blockingIssues.push("IdentityLock missing platform");
      return false;
    }

    if (!lock.customer_identity || !lock.customer_identity.kind || !lock.customer_identity.value) {
      blockingIssues.push("IdentityLock missing or incomplete customer_identity");
      return false;
    }

    if (!lock.conversation_id || lock.conversation_id.trim() === "") {
      blockingIssues.push("IdentityLock missing conversation_id");
      return false;
    }

    reasons.push("IdentityLock validated");
    return true;
  }

  /**
   * Validate fact references in ReplyPlan.
   *
   * @param replyPlan - ReplyPlan to validate
   * @param warnings - Array to collect warnings
   * @param reasons - Array to collect reasons
   */
  private validateFacts(
    replyPlan: ReplyPlan,
    warnings: string[],
    reasons: string[]
  ): void {
    const factRefs = replyPlan.fact_references || [];

    if (factRefs.length === 0) {
      warnings.push("No fact references in ReplyPlan");
      return;
    }

    reasons.push(`Fact references validated: ${factRefs.length} facts`);
  }

  /**
   * Check for blocking unknowns in ContextEnvelope.
   *
   * @param envelope - ContextEnvelope to check
   * @param blockingIssues - Array to collect blocking issues
   * @param reasons - Array to collect reasons
   * @returns true if blocking unknowns present, false otherwise
   */
  private checkBlockingUnknowns(
    envelope: ContextEnvelope,
    blockingIssues: string[],
    reasons: string[]
  ): boolean {
    const unknowns = envelope.explicit_unknowns || [];
    const blockingUnknowns = unknowns.filter((u) => u.blocking !== false);

    if (blockingUnknowns.length > 0) {
      blockingUnknowns.forEach((u) => {
        blockingIssues.push(`Blocking unknown: ${u.description}`);
      });
      return true;
    }

    reasons.push("No blocking unknowns");
    return false;
  }

  /**
   * Check capability/entitlement for AI functionality.
   *
   * MVP: Always returns true (simplified check).
   * Future: Check actual capability/entitlement from database.
   *
   * @param envelope - ContextEnvelope to check
   * @param reasons - Array to collect reasons
   * @returns true if capability enabled, false otherwise
   */
  private checkCapability(envelope: ContextEnvelope, reasons: string[]): boolean {
    // MVP: Always true
    // Future: Check actual capability from database
    reasons.push("Capability check passed (MVP: always enabled)");
    return true;
  }

  /**
   * Assess risk level based on envelope context.
   *
   * MVP: Simplified risk assessment based on:
   * - Scene (some scenes are higher risk)
   *
   * Note: Blocking unknowns are handled separately in Step 3 (early return).
   *
   * @param envelope - ContextEnvelope to assess
   * @param warnings - Array to collect warnings
   * @returns Risk level: "low" | "medium" | "high"
   */
  private assessRiskLevel(
    envelope: ContextEnvelope,
    warnings: string[]
  ): "low" | "medium" | "high" {
    // Medium risk: certain scenes (refund, return, complaint)
    const highRiskScenes = ["RETURN_POLICY", "REFUND", "COMPLAINT"];
    if (highRiskScenes.includes(envelope.scene)) {
      warnings.push(`Risk level: medium (scene: ${envelope.scene})`);
      return "medium";
    }

    // Low risk: default
    return "low";
  }
}

/**
 * Helper function to create a PolicyEngine.
 *
 * @returns New PolicyEngine instance
 *
 * @example
 * ```typescript
 * const engine = createPolicyEngine();
 * const decision = await engine.evaluate(envelope, replyPlan, config);
 * ```
 */
export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}
