/**
 * Stub AuthoritativeFacts Provider (SHEEP-306, P1-6c).
 *
 * Purpose: Provide a stub implementation of AuthoritativeFactsPort for MVP.
 * This stub returns empty/stub facts for all fact types except knowledge_facts,
 * which will be populated by the Builder using StoreKnowledgeRetrievalPort.
 *
 * Governance basis:
 * - SHEEP-306: MVP scope only includes knowledge_facts.
 * - P2-15: order_facts / logistics_facts are DEFERRED.
 *
 * Key invariants:
 * - Stub returns empty objects for shop_facts / product_facts (explicit markers).
 * - Stub returns undefined for order_facts / logistics_facts (DEFERRED).
 * - knowledge_facts are NOT populated here; Builder orchestrates that.
 * - This stub is for testing and as a fallback when facts are unavailable.
 *
 * Owner SHEEP-306 decisions:
 * D1: Stub clearly marks which fact types are not yet implemented.
 * D2: Stub does NOT attempt to populate knowledge_facts (Builder's responsibility).
 * D3: Stub is useful for testing Builder logic without real fact sources.
 */

import type { AuthoritativeFacts } from "@fastwork/domain";
import type { AuthoritativeFactsPort, FactsGatherParams } from "../ports/authoritative-facts-port.js";

/**
 * Stub implementation of AuthoritativeFactsPort.
 *
 * Returns:
 * - shop_facts: {} (empty, stub)
 * - product_facts: {} (empty, stub)
 * - order_facts: undefined (DEFERRED to P2-15)
 * - logistics_facts: undefined (DEFERRED to P2-15)
 * - knowledge_facts: {} (empty, Builder will populate via StoreKnowledgeRetrievalPort)
 *
 * This stub is useful for:
 * - Testing Builder logic without real fact sources.
 * - Fallback when fact retrieval fails.
 * - Gradual rollout (enable fact types one by one).
 */
export class StubAuthoritativeFactsProvider implements AuthoritativeFactsPort {
  /**
   * Gather authoritative facts (stub implementation).
   *
   * @param params - Gather parameters (merchant_id, store_id required)
   * @returns AuthoritativeFacts with stub/empty facts
   */
  async gather(params: FactsGatherParams): Promise<AuthoritativeFacts> {
    // Validate required parameters
    if (!params.merchant_id || !params.store_id) {
      throw new Error("merchant_id and store_id are required for facts gathering");
    }

    // Return stub facts.
    // - shop_facts / product_facts: empty objects (explicit stubs, future work).
    // - order_facts / logistics_facts: undefined (DEFERRED to P2-15).
    // - knowledge_facts: empty object (Builder will populate via StoreKnowledgeRetrievalPort).
    return {
      shop_facts: {},
      product_facts: {},
      // order_facts: undefined, // DEFERRED (P2-15)
      // logistics_facts: undefined, // DEFERRED (P2-15)
      knowledge_facts: {},
    };
  }
}

/**
 * Factory function for creating a StubAuthoritativeFactsProvider.
 *
 * @returns A new StubAuthoritativeFactsProvider instance
 */
export function createStubAuthoritativeFactsProvider(): AuthoritativeFactsPort {
  return new StubAuthoritativeFactsProvider();
}
