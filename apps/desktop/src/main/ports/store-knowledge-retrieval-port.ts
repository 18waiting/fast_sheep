/**
 * StoreKnowledge Retrieval Port (SHEEP-306, P1-6a).
 *
 * Purpose: Define the Main-side port for retrieving Store Knowledge entries.
 * This is the abstraction boundary between ContextEnvelopeBuilder and the
 * actual retrieval mechanism (Worker RPC bridge or direct DB read).
 *
 * Governance basis:
 * - DEC-008: Store Knowledge is layer 3 (store-scoped merchant knowledge).
 * - SHEEP-305: Worker-side RPC methods store_knowledge.query / store_knowledge.list.
 * - SHEEP-306: ContextEnvelope.retrieved_knowledge needs Store Knowledge data.
 *
 * Key invariants:
 * - Port is a read-only interface (retrieval only, no writes).
 * - Uses snake_case naming consistent with Contract Schema types.
 * - knowledge_type uses Layer 2 fine-grained vocabulary (SHIPPING_TIME, etc.)
 *   because that matches the DB schema and Worker RPC.
 * - Layer 1 → Layer 2 mapping happens in the Builder, not here.
 * - Implementation (P1-6b) bridges to Worker RPC.
 *
 * Owner SHEEP-306 decisions:
 * D1: Port uses Layer 2 knowledge_type (DB-level), not Layer 1 (ContextEnvelope-level).
 * D2: Port is implementation-agnostic — could be RPC bridge or direct DB read.
 * D3: Port returns raw StoreKnowledgeEntry; Builder maps to RetrievedKnowledge.
 */

import type { StoreKnowledgeType } from "@fastwork/domain";

/**
 * Status filter for Store Knowledge queries.
 * Mirrors the DB CHECK constraint: ACTIVE | DRAFT | ARCHIVED.
 */
export type StoreKnowledgeStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

/**
 * Query parameters for Store Knowledge retrieval.
 *
 * Required:
 * - merchant_id: Scope to merchant (DEC-008 layer 2).
 * - store_id: Scope to store (DEC-008 layer 3).
 *
 * Optional filters:
 * - keywords: Keyword-based matching (MVP-A: SQL LIKE on title/content/tags).
 * - knowledge_type: Layer 2 fine-grained type filter.
 * - status: Lifecycle status filter (default: ACTIVE).
 * - limit: Maximum entries to return (default: 20, max: 100).
 */
export interface StoreKnowledgeQueryParams {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly keywords?: readonly string[];
  readonly knowledge_type?: StoreKnowledgeType;
  readonly status?: StoreKnowledgeStatus;
  readonly limit?: number;
}

/**
 * A single Store Knowledge entry as returned by the retrieval port.
 *
 * This mirrors the Worker RPC response shape and DB schema.
 * Fields align with resources/contracts/schemas/domain/store-knowledge.schema.json.
 *
 * Note: This is NOT the same as ContextEnvelope's RetrievedKnowledge.
 * The Builder maps StoreKnowledgeEntry → RetrievedKnowledge, adding:
 * - relevance_score (from keyword match quality or future RAG score)
 * - matched_keywords (which keywords matched this entry)
 * - Layer 1 knowledge_type classification
 */
export interface StoreKnowledgeEntry {
  readonly id: string;
  readonly merchant_id: string;
  readonly store_id: string;
  readonly knowledge_type: StoreKnowledgeType;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly source: "OWNER_INPUT" | "IMPORTED";
  readonly status: StoreKnowledgeStatus;
  readonly created_at: string; // ISO 8601
  readonly updated_at: string; // ISO 8601
}

/**
 * Result of a Store Knowledge query.
 */
export interface StoreKnowledgeQueryResult {
  readonly ok: boolean;
  readonly entries: readonly StoreKnowledgeEntry[];
  readonly count: number;
  readonly error?: string;
}

/**
 * StoreKnowledge Retrieval Port.
 *
 * This is the abstraction boundary for Store Knowledge retrieval.
 * Implementation (P1-6b) bridges to Worker RPC store_knowledge.query.
 *
 * Usage in ContextEnvelopeBuilder:
 * ```typescript
 * const port: StoreKnowledgeRetrievalPort = ...; // injected
 * const result = await port.query({
 *   merchant_id: identityLock.merchant_id,
 *   store_id: identityLock.store_id,
 *   keywords: extractKeywords(triggerMessage.content),
 *   status: "ACTIVE",
 *   limit: 20,
 * });
 * if (result.ok) {
 *   const knowledge = result.entries.map(mapToRetrievedKnowledge);
 * }
 * ```
 */
export interface StoreKnowledgeRetrievalPort {
  /**
   * Query Store Knowledge entries by keywords and filters.
   *
   * MVP-A: Keyword-based retrieval (SQL LIKE matching).
   * Phase 9: Vector retrieval (embeddings + FAISS).
   *
   * @param params - Query parameters (merchant_id, store_id required)
   * @returns Query result with matching entries
   */
  query(params: StoreKnowledgeQueryParams): Promise<StoreKnowledgeQueryResult>;

  /**
   * List Store Knowledge entries without keyword matching.
   * Useful for browsing or debugging.
   *
   * @param params - Query parameters (keywords ignored if provided)
   * @returns Query result with matching entries
   */
  list(params: Omit<StoreKnowledgeQueryParams, "keywords">): Promise<StoreKnowledgeQueryResult>;
}
