/**
 * AuthoritativeFacts Retrieval Port (SHEEP-306, P1-6c).
 *
 * Purpose: Define the Main-side port for gathering authoritative facts
 * to populate ContextEnvelope.authoritative_facts.
 *
 * Governance basis:
 * - DEC-SHEEP-306: ContextEnvelope contains AuthoritativeFacts.
 * - Master §5: Facts carry provenance (source, confidence, retrieval time).
 * - SHEEP-306 P2-15: order_facts / logistics_facts are DEFERRED.
 *
 * Key invariants:
 * - Port is read-only (gathering only, no writes).
 * - All facts are provenanced with confidence = 1.0 (from database).
 * - MVP scope: only knowledge_facts are populated (from StoreKnowledge).
 * - shop_facts / product_facts return empty objects (explicit stubs).
 * - order_facts / logistics_facts are DEFERRED (P2-15).
 *
 * Owner SHEEP-306 decisions:
 * D1: Port returns AuthoritativeFacts (Contract Schema type from domain).
 * D2: MVP only populates knowledge_facts; others are explicit stubs.
 * D3: Stub implementation marks missing fact types clearly.
 */

import type { AuthoritativeFacts } from "@fastwork/domain";

/**
 * Parameters for gathering authoritative facts.
 *
 * Required:
 * - merchant_id: Scope to merchant (DEC-008 layer 2).
 * - store_id: Scope to store (DEC-008 layer 3).
 *
 * Optional:
 * - product_id: If present, gather product-specific facts.
 * - order_id: If present, gather order-specific facts (DEFERRED).
 */
export interface FactsGatherParams {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly product_id?: string;
  readonly order_id?: string;
}

/**
 * AuthoritativeFacts Retrieval Port.
 *
 * This is the abstraction boundary for gathering authoritative facts.
 * Implementation (P1-6e Builder) orchestrates multiple fact sources.
 *
 * Usage in ContextEnvelopeBuilder:
 * ```typescript
 * const factsPort: AuthoritativeFactsPort = ...; // injected
 * const facts = await factsPort.gather({
 *   merchant_id: identityLock.merchant_id,
 *   store_id: identityLock.store_id,
 *   product_id: extractedProductId,
 * });
 * // facts.authoritative_facts now contains:
 * // - knowledge_facts: from StoreKnowledge (via StoreKnowledgeRetrievalPort)
 * // - shop_facts: {} (stub)
 * // - product_facts: {} (stub)
 * // - order_facts: undefined (DEFERRED)
 * // - logistics_facts: undefined (DEFERRED)
 * ```
 */
export interface AuthoritativeFactsPort {
  /**
   * Gather authoritative facts for the given scope.
   *
   * MVP scope:
   * - knowledge_facts: Populated from StoreKnowledge retrieval.
   * - shop_facts: Empty object (stub, future work).
   * - product_facts: Empty object (stub, future work).
   * - order_facts: Undefined (DEFERRED to P2-15).
   * - logistics_facts: Undefined (DEFERRED to P2-15).
   *
   * @param params - Gather parameters (merchant_id, store_id required)
   * @returns AuthoritativeFacts with provenanced facts
   */
  gather(params: FactsGatherParams): Promise<AuthoritativeFacts>;
}
