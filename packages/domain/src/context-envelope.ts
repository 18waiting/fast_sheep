/**
 * ContextEnvelope Domain (SHEEP-306, Phase 1).
 *
 * Governance basis:
 * - Master §5: AI input must be structured and governed.
 * - DEC-SHEEP-306: ContextEnvelope is the canonical AI input format (Format C).
 * - Evolution path: Format A (ConversationEngineRequest) → Format C (ContextEnvelope).
 *
 * Key invariants:
 * - IdentityLock is structural, not implicit.
 * - Facts carry provenance (source, confidence, retrieval time).
 * - Knowledge is shop-scoped before multi-shop AUTO.
 * - Unknowns are explicit, not hidden.
 *
 * Owner SHEEP-306 decisions:
 * D1: IdentityLock is structural safety, not business validation.
 * D2: Facts come from database (confidence = 1.0).
 * D3: Knowledge comes from RAG (has relevance score).
 * D4: Unknowns are explicit markers, not implicit missing data.
 *
 * **Contract Schema Types — Not Domain Layer Types**
 *
 * These TypeScript types mirror the JSON Schema definitions in
 * `resources/contracts/schemas/domain/context-envelope.schema.json`.
 * They use flat strings with snake_case naming, distinct from the
 * Domain Layer types in `identity-inbound.ts` which use
 * `IdentityResolution<T>` wrapper and camelCase naming.
 *
 * When these types need to be converted to/from Domain Layer types,
 * an explicit mapping layer must be implemented (future work).
 */

import type { PlatformId } from "./merchant-domain.js";

/**
 * RolloutMode governs how AI replies are executed.
 * - OFF: No AI reply execution.
 * - SHADOW: AI generates reply but does not execute (for testing/monitoring).
 * - HUMAN_CONFIRM: AI proposes reply, human confirmation required before execution.
 * - AUTO: Policy-approved reply may execute automatically.
 */
export type RolloutMode = "OFF" | "SHADOW" | "HUMAN_CONFIRM" | "AUTO";

/**
 * Layer 1: Coarse-grained knowledge classification.
 * - PRODUCT_KNOWLEDGE: Product-related knowledge (catalog, specs, etc.).
 * - STORE_RULE: Store-level rules and policies (shipping, returns, etc.).
 */
export type KnowledgeType = "PRODUCT_KNOWLEDGE" | "STORE_RULE";

/**
 * Layer 2: Fine-grained store knowledge classification.
 * Used only when knowledge_type = STORE_RULE.
 */
export type StoreKnowledgeType = "SHIPPING_TIME" | "RETURN_POLICY" | "FAQ" | "OTHER";

/**
 * Customer identity representation (Contract Schema format).
 * For PDD: kind = "customerUid", value = customerUid.
 */
export interface ContractCustomerIdentity {
  readonly kind: "customerUid" | "buyer_id" | "user_id";
  readonly value: string;
}

/**
 * ContractIdentityLock: Immutable identity scope for ContextEnvelope (Contract Schema format).
 * Structural safety, not business validation.
 *
 * Note: This is distinct from the Domain Layer `IdentityLock` in `identity-inbound.ts`.
 * This uses flat strings (snake_case) for JSON Schema compatibility.
 * Domain Layer uses `IdentityResolution<T>` wrapper (camelCase).
 */
export interface ContractIdentityLock {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly platform: PlatformId;
  readonly platform_account_id: string;
  readonly customer_identity: ContractCustomerIdentity;
  readonly conversation_id: string;
  readonly trigger_message_id: string;
  readonly generation?: number;
}

/**
 * ContractTriggerMessage: The inbound message that triggered this envelope (Contract Schema format).
 */
export interface ContractTriggerMessage {
  readonly message_id: string;
  readonly content: string;
  readonly received_at: string; // ISO 8601 datetime
}

/**
 * ProvenancedFact: Authoritative fact with provenance tracking.
 * Facts come from database with confidence = 1.0.
 */
export interface ProvenancedFact {
  readonly value: unknown;
  readonly source: string;
  readonly confidence: 1.0;
  readonly retrieved_at: string; // ISO 8601 datetime
}

/**
 * AuthoritativeFacts: Collection of authoritative business facts.
 * All facts are provenanced and have confidence = 1.0.
 */
export interface AuthoritativeFacts {
  readonly shop_facts?: Record<string, ProvenancedFact>;
  readonly product_facts?: Record<string, ProvenancedFact>;
  readonly order_facts?: Record<string, ProvenancedFact>;
  readonly logistics_facts?: Record<string, ProvenancedFact>;
  readonly knowledge_facts?: Record<string, ProvenancedFact>;
}

/**
 * RetrievedKnowledge: Knowledge retrieved from Store Knowledge or product knowledge.
 * Has relevance score from RAG retrieval.
 */
export interface RetrievedKnowledge {
  readonly knowledge_id: string;
  readonly knowledge_type: KnowledgeType;
  readonly store_knowledge_type?: StoreKnowledgeType;
  readonly title: string;
  readonly content: string;
  readonly relevance_score: number; // 0.0 to 1.0
  readonly matched_keywords?: string[];
}

/**
 * ConversationTurn: A single turn in conversation history.
 */
export interface ConversationTurn {
  readonly turn_id: string;
  readonly role: "customer" | "agent" | "ai";
  readonly content: string;
  readonly timestamp: string; // ISO 8601 datetime
}

/**
 * ExplicitUnknown: Explicit marker for missing information that blocks execution.
 * Unknowns are explicit, not hidden.
 */
export interface ExplicitUnknown {
  readonly unknown_id: string;
  readonly category: string;
  readonly description: string;
  readonly blocking: boolean;
}

/**
 * ContextEnvelope: Structured input to AI (Format C, Contract Schema format).
 * Contains identity lock, authoritative facts, retrieved knowledge, and explicit unknowns.
 */
export interface ContextEnvelope {
  readonly envelope_id: string;
  readonly conversation_id: string;
  readonly identity_lock: ContractIdentityLock;
  readonly scene: string;
  readonly trigger_message: ContractTriggerMessage;
  readonly authoritative_facts?: AuthoritativeFacts;
  readonly retrieved_knowledge?: RetrievedKnowledge[];
  readonly conversation_context?: ConversationTurn[];
  readonly explicit_unknowns?: readonly ExplicitUnknown[];
  readonly created_at: string; // ISO 8601 datetime
}
