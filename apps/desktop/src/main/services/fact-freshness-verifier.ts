/**
 * Fact Freshness Verifier (SHEEP-306, P2-8c).
 *
 * Purpose: Verify fact references in ReplyPlan exist in authoritative_facts.
 * Ensures AI reply is based on valid, retrievable facts.
 *
 * Governance basis:
 * - Master §5: Facts carry provenance and must be verifiable.
 * - DEC-SHEEP-306: Fact references must be validated before execution.
 * - REPLY_AND_ACTION_SAFETY.md: Fact verification is structural.
 *
 * Key invariants:
 * - Pure function, no side effects.
 * - Validates fact_id exists in authoritative_facts.
 * - Validates fact source is within bounded vocabulary.
 * - Does NOT validate timestamp freshness (MVP simplification).
 * - Does NOT validate value_snapshot consistency (MVP simplification).
 *
 * Owner SHEEP-306 decisions:
 * D1: Fact verifier is a pure function, not a service.
 * D2: MVP validates existence, not temporal freshness.
 * D3: Missing facts are blocking errors (prevent execution).
 */

import type { ReplyPlan, FactReference, AuthoritativeFacts } from "@fastwork/domain";
import type { VerificationError } from "../ports/reply-plan-verifier-port.js";

/**
 * Valid fact sources (bounded vocabulary).
 * Aligns with FactReference.source.
 */
const VALID_FACT_SOURCES: readonly FactReference["source"][] = [
  "platform_api",
  "merchant_config",
  "store_knowledge",
  "product_knowledge",
  "order_system",
  "logistics_system",
];

/**
 * Fact category extracted from fact_key.
 * Maps to AuthoritativeFacts fields.
 */
type FactCategory = "shop_facts" | "product_facts" | "order_facts" | "logistics_facts" | "knowledge_facts";

/**
 * Result of fact freshness verification.
 */
export interface FactFreshnessVerificationResult {
  readonly ok: boolean;
  readonly errors: readonly VerificationError[];
}

/**
 * Verify fact references in ReplyPlan exist in authoritative_facts.
 *
 * Validation rules:
 * 1. Each fact_reference.fact_id must exist in authoritative_facts.
 * 2. fact_reference.source must be within bounded vocabulary.
 * 3. fact_key format must be "<category>.<key>" (e.g., "shop_facts.shipping_policy").
 *
 * @param plan - The ReplyPlan to verify
 * @param facts - The AuthoritativeFacts from ContextEnvelope
 * @returns Verification result with errors (if any)
 */
export function verifyFactFreshness(
  plan: ReplyPlan,
  facts: AuthoritativeFacts | undefined,
): FactFreshnessVerificationResult {
  const errors: VerificationError[] = [];

  // If no fact_references, nothing to verify
  if (!plan.fact_references || plan.fact_references.length === 0) {
    return { ok: true, errors: [] };
  }

  // If no authoritative_facts but we have fact_references, all facts are missing
  if (!facts) {
    for (const ref of plan.fact_references) {
      errors.push({
        error_id: `fact_missing_${ref.fact_id}`,
        category: "fact_freshness",
        severity: "error",
        message: `Fact "${ref.fact_id}" referenced but authoritative_facts is empty`,
        blocking: true,
      });
    }
    return { ok: false, errors };
  }

  // Verify each fact reference
  for (const ref of plan.fact_references) {
    // Validate source
    if (!VALID_FACT_SOURCES.includes(ref.source)) {
      errors.push({
        error_id: `fact_invalid_source_${ref.fact_id}`,
        category: "fact_freshness",
        severity: "error",
        message: `Fact "${ref.fact_id}" has invalid source "${ref.source}"`,
        blocking: true,
      });
      continue;
    }

    // Parse fact_key to extract category and key
    const parsed = parseFactKey(ref.fact_key);
    if (!parsed) {
      errors.push({
        error_id: `fact_invalid_key_format_${ref.fact_id}`,
        category: "fact_freshness",
        severity: "error",
        message: `Fact "${ref.fact_id}" has invalid fact_key format "${ref.fact_key}"`,
        blocking: true,
      });
      continue;
    }

    // Check if fact exists in authoritative_facts
    const categoryFacts = facts[parsed.category];
    if (!categoryFacts || !(parsed.key in categoryFacts)) {
      errors.push({
        error_id: `fact_missing_${ref.fact_id}`,
        category: "fact_freshness",
        severity: "error",
        message: `Fact "${ref.fact_id}" (key: ${ref.fact_key}) not found in authoritative_facts`,
        blocking: true,
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Parse fact_key into category and key.
 *
 * Format: "<category>.<key>" (e.g., "shop_facts.shipping_policy")
 *
 * @param factKey - The fact_key string
 * @returns Parsed category and key, or null if invalid format
 */
function parseFactKey(factKey: string): { category: FactCategory; key: string } | null {
  const parts = factKey.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [category, key] = parts;

  // Validate category
  const validCategories: FactCategory[] = [
    "shop_facts",
    "product_facts",
    "order_facts",
    "logistics_facts",
    "knowledge_facts",
  ];

  if (!validCategories.includes(category as FactCategory)) {
    return null;
  }

  return {
    category: category as FactCategory,
    key,
  };
}
