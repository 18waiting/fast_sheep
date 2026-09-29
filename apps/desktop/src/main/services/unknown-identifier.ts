/**
 * Unknown Identifier (SHEEP-306, P1-6d).
 *
 * Purpose: Identify explicit unknowns that block or inform AI reply generation.
 * Unknowns are explicit markers, not implicit missing data.
 *
 * Governance basis:
 * - DEC-SHEEP-306: ContextEnvelope contains explicit_unknowns.
 * - Master §5: Unknowns are explicit, not hidden.
 * - SHEEP-304: MINIMAL_V1 scene contract (bounded vocabulary).
 *
 * Key invariants:
 * - Pure function, no side effects.
 * - Unknown identification depends on Scene (different scenes need different facts).
 * - Unknowns have `blocking` property (determines if AI should proceed).
 * - MVP rules are deterministic (no AI-based unknown detection).
 *
 * Owner SHEEP-306 decisions:
 * D1: UnknownIdentifier is a pure function, not a service.
 * D2: Unknown rules are scene-specific (SHIPPING_TIME needs knowledge, UNKNOWN needs identity).
 * D3: Blocking unknowns prevent AI reply; non-blocking are informational.
 */

import type { AuthoritativeFacts, ContractIdentityLock, ExplicitUnknown } from "@fastwork/domain";
import type { MinimalScene } from "./minimal-scene-classifier.js";

/**
 * Parameters for unknown identification.
 */
export interface UnknownIdentificationParams {
  readonly identity_lock: ContractIdentityLock;
  readonly facts: AuthoritativeFacts;
  readonly scene: MinimalScene;
}

/**
 * Result of unknown identification.
 */
export interface UnknownIdentificationResult {
  readonly unknowns: readonly ExplicitUnknown[];
  readonly has_blocking_unknown: boolean;
}

/**
 * Identify explicit unknowns based on scene and available facts.
 *
 * MVP Rules:
 * - SHIPPING_TIME scene: Requires knowledge_facts with SHIPPING_TIME type.
 *   Blocking unknown if missing: "missing_shipping_time_rule".
 * - OTHER_UNSUPPORTED scene: No required facts, no blocking unknowns.
 * - UNKNOWN scene: Requires complete identity_lock.
 *   Blocking unknown if incomplete: "incomplete_identity".
 *
 * @param params - Identity lock, facts, and scene
 * @returns List of explicit unknowns with blocking flag
 */
export function identifyUnknowns(params: UnknownIdentificationParams): UnknownIdentificationResult {
  const { identity_lock, facts, scene } = params;
  const unknowns: ExplicitUnknown[] = [];

  // Scene-specific unknown detection
  switch (scene) {
    case "SHIPPING_TIME": {
      // SHIPPING_TIME scene requires knowledge_facts with SHIPPING_TIME type
      const hasShippingTimeKnowledge = hasKnowledgeOfType(facts, "SHIPPING_TIME");
      if (!hasShippingTimeKnowledge) {
        unknowns.push({
          unknown_id: "missing_shipping_time_rule",
          category: "knowledge",
          description: "Missing shipping time rule knowledge for this store",
          blocking: true,
        });
      }
      break;
    }

    case "OTHER_UNSUPPORTED": {
      // OTHER_UNSUPPORTED scene has no required facts, no blocking unknowns
      // (by design: this scene means "we don't support AI reply for this")
      break;
    }

    case "UNKNOWN": {
      // UNKNOWN scene requires complete identity_lock
      const identityComplete = isIdentityLockComplete(identity_lock);
      if (!identityComplete) {
        unknowns.push({
          unknown_id: "incomplete_identity",
          category: "identity",
          description: "Identity lock is incomplete; cannot determine customer scope",
          blocking: true,
        });
      }
      break;
    }

    default: {
      // Exhaustive check: if new scenes are added, this will fail at compile time
      const _exhaustive: never = scene;
      throw new Error(`Unknown scene: ${_exhaustive}`);
    }
  }

  const has_blocking_unknown = unknowns.some((u) => u.blocking);

  return {
    unknowns,
    has_blocking_unknown,
  };
}

/**
 * Check if knowledge_facts contains entries of a specific type.
 *
 * MVP: knowledge_facts is a Record<string, ProvenancedFact>.
 * We check if any key exists (actual type filtering happens in Builder).
 *
 * @param facts - Authoritative facts
 * @param knowledgeType - Knowledge type to check (e.g., "SHIPPING_TIME")
 * @returns true if knowledge_facts has entries
 */
function hasKnowledgeOfType(facts: AuthoritativeFacts, knowledgeType: string): boolean {
  // MVP: knowledge_facts is populated by Builder from StoreKnowledgeRetrievalPort.
  // We check if knowledge_facts exists and has any entries.
  // Actual type filtering (SHIPPING_TIME vs RETURN_POLICY) happens in Builder.
  // For now, we just check if knowledge_facts is non-empty.
  const knowledgeFacts = facts.knowledge_facts;
  if (!knowledgeFacts) {
    return false;
  }
  return Object.keys(knowledgeFacts).length > 0;
}

/**
 * Check if identity lock is complete (all required fields present).
 *
 * Required fields:
 * - merchant_id
 * - store_id
 * - platform
 * - platform_account_id
 * - customer_identity (kind + value)
 * - conversation_id
 * - trigger_message_id
 *
 * @param lock - Contract identity lock
 * @returns true if all required fields are present and non-empty
 */
function isIdentityLockComplete(lock: ContractIdentityLock): boolean {
  // Check required string fields
  const requiredStringFields: Array<keyof ContractIdentityLock> = [
    "merchant_id",
    "store_id",
    "platform",
    "platform_account_id",
    "conversation_id",
    "trigger_message_id",
  ];

  for (const field of requiredStringFields) {
    const value = lock[field];
    if (typeof value !== "string" || value.trim() === "") {
      return false;
    }
  }

  // Check customer_identity (object with kind + value)
  const customerIdentity = lock.customer_identity;
  if (!customerIdentity) {
    return false;
  }
  if (typeof customerIdentity.kind !== "string" || customerIdentity.kind.trim() === "") {
    return false;
  }
  if (typeof customerIdentity.value !== "string" || customerIdentity.value.trim() === "") {
    return false;
  }

  return true;
}
