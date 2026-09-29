/**
 * ContextEnvelope Builder (SHEEP-306, P1-6e).
 *
 * Purpose: Assemble all sub-components to build a complete ContextEnvelope.
 * This is the main entry point for ContextEnvelope construction.
 *
 * Governance basis:
 * - DEC-SHEEP-306: ContextEnvelope is the canonical AI input format (Format C).
 * - Master §5: AI input must be structured and governed.
 * - SHEEP-304: MINIMAL_V1 scene contract (bounded vocabulary).
 *
 * Key invariants:
 * - Builder orchestrates: IdentityLock → Scene → Facts → Knowledge → Unknowns → Envelope.
 * - Builder uses dependency injection for all sub-components.
 * - Builder maps Domain Layer types (InboundTurn) to Contract Schema types (ContextEnvelope).
 * - Builder does NOT modify Orchestrator (P1-6f does integration).
 * - Builder does NOT handle error recovery (MVP simplification).
 *
 * Owner SHEEP-306 decisions:
 * D1: Builder is a service class with injected dependencies.
 * D2: Builder maps InboundTurn.identity_lock → ContractIdentityLock.
 * D3: Builder calls sub-components in sequence: Scene → Facts → Knowledge → Unknowns.
 *
 * SHEEP-308 extension:
 * D4: Builder optionally integrates PolicyEngine for policy evaluation.
 * D5: evaluatePolicy() method provides policy evaluation after ReplyPlan is available.
 */

import { randomUUID } from "node:crypto";
import type {
  ContextEnvelope,
  ContractIdentityLock,
  ContractCustomerIdentity,
  ContractTriggerMessage,
  AuthoritativeFacts,
  RetrievedKnowledge,
  ExplicitUnknown,
  ReplyPlan,
  PolicyConfig,
  PolicyDecision,
} from "@fastwork/domain";
import type { MinimalSceneClassifier, SceneClassification, SceneMessageFact } from "./minimal-scene-classifier.js";
import type { InboundTurn } from "./inbound-turn-builder.js";
import { adaptSceneToEnvelope } from "./scene-envelope-adapter.js";
import { identifyUnknowns } from "./unknown-identifier.js";
import type { AuthoritativeFactsPort } from "../ports/authoritative-facts-port.js";
import type { StoreKnowledgeRetrievalPort, StoreKnowledgeEntry } from "../ports/store-knowledge-retrieval-port.js";
import { getKnowledgeFilter } from "@fastwork/domain"; // SHEEP-305: Scene-based knowledge routing
import type { PolicyEngine } from "./policy-engine.js"; // SHEEP-308: Policy evaluation

/**
 * Clock interface for timestamp generation.
 */
export interface Clock {
  now(): string; // ISO 8601 datetime string
}

/**
 * Default clock implementation using system time.
 */
export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

/**
 * Builder dependencies (injected via constructor).
 */
export interface ContextEnvelopeBuilderDeps {
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly factsPort: AuthoritativeFactsPort;
  readonly knowledgePort: StoreKnowledgeRetrievalPort;
  readonly clock?: Clock; // Optional, defaults to SystemClock
  readonly policyEngine?: PolicyEngine; // SHEEP-308: Optional policy evaluation
  readonly policyConfig?: PolicyConfig; // SHEEP-308: Policy configuration
}

/**
 * Builder input parameters.
 */
export interface ContextEnvelopeBuildInput {
  readonly turn: InboundTurn;
  readonly messageFacts: readonly SceneMessageFact[];
  readonly productId?: string;
}

/**
 * ContextEnvelope Builder.
 *
 * Orchestrates the construction of ContextEnvelope from InboundTurn.
 *
 * Usage:
 * ```typescript
 * const builder = new ContextEnvelopeBuilder({
 *   sceneClassifier: createMinimalSceneClassifier(),
 *   factsPort: createStubAuthoritativeFactsProvider(),
 *   knowledgePort: createRpcStoreKnowledgeRetrievalAdapter(workerClient),
 *   clock: new SystemClock(),
 *   policyEngine: createPolicyEngine(), // SHEEP-308: optional
 *   policyConfig: createSimplePolicyConfig("HUMAN_CONFIRM"), // SHEEP-308: optional
 * });
 *
 * const envelope = await builder.build({
 *   turn: inboundTurn,
 *   messageFacts: sceneMessageFacts,
 *   productId: "prod_123",
 * });
 *
 * // After ReplyPlan is available:
 * const policyDecision = await builder.evaluatePolicy(envelope, replyPlan);
 * ```
 */
export class ContextEnvelopeBuilder {
  private readonly clock: Clock;

  constructor(private readonly deps: ContextEnvelopeBuilderDeps) {
    this.clock = deps.clock ?? new SystemClock();
  }

  /**
   * Build a complete ContextEnvelope from InboundTurn.
   *
   * Steps:
   * 1. Build ContractIdentityLock from InboundTurn.identity_lock
   * 2. Classify scene using MinimalSceneClassifier + adaptSceneToEnvelope
   * 3. Gather facts using AuthoritativeFactsPort
   * 4. Retrieve knowledge using StoreKnowledgeRetrievalPort
   * 5. Identify unknowns using identifyUnknowns
   * 6. Assemble ContextEnvelope
   *
   * @param input - Build input (turn, messageFacts, productId)
   * @returns Complete ContextEnvelope
   */
  async build(input: ContextEnvelopeBuildInput): Promise<ContextEnvelope> {
    const { turn, messageFacts, productId } = input;

    // Step 1: Build ContractIdentityLock
    const identityLock = this.buildContractIdentityLock(turn);

    // Step 2: Classify scene
    const sceneClassification = this.deps.sceneClassifier.classify({
      turn,
      messages: messageFacts,
    });
    const scene = adaptSceneToEnvelope(sceneClassification);

    // Step 3: Gather facts
    const facts = await this.deps.factsPort.gather({
      merchant_id: identityLock.merchant_id,
      store_id: identityLock.store_id,
      product_id: productId,
    });

    // Step 4: Retrieve knowledge (SHEEP-305: scene-based knowledge routing)
    const knowledge = await this.retrieveKnowledge(identityLock, turn, sceneClassification.scene);

    // Step 5: Identify unknowns
    const unknownResult = identifyUnknowns({
      identity_lock: identityLock,
      scene: sceneClassification.scene,
      facts,

    });

    // Step 6: Assemble ContextEnvelope
    const envelope: ContextEnvelope = {
      envelope_id: randomUUID(),
      conversation_id: identityLock.conversation_id,
      identity_lock: identityLock,
      scene,
      trigger_message: this.buildTriggerMessage(turn),
      authoritative_facts: facts,
      retrieved_knowledge: knowledge.length > 0 ? knowledge : undefined,
      explicit_unknowns: unknownResult.unknowns.length > 0 ? unknownResult.unknowns : undefined,
      created_at: this.clock.now(),
    };

    return envelope;
  }

  /**
   * Evaluate policy for a ReplyPlan (SHEEP-308).
   *
   * This method provides policy evaluation after both ContextEnvelope and ReplyPlan
   * are available. It delegates to PolicyEngine if configured.
   *
   * @param envelope - ContextEnvelope (from build())
   * @param replyPlan - ReplyPlan (from AI output)
   * @returns PolicyDecision with evaluation result, or null if PolicyEngine not configured
   *
   * @example
   * ```typescript
   * const envelope = await builder.build(input);
   * const replyPlan = await buildReplyPlan(envelope, aiReply);
   * const decision = await builder.evaluatePolicy(envelope, replyPlan);
   *
   * if (decision && !decision.allowed) {
   *   console.log("Blocked:", decision.blocking_issues);
   * }
   * ```
   */
  async evaluatePolicy(
    envelope: ContextEnvelope,
    replyPlan: ReplyPlan,
  ): Promise<PolicyDecision | null> {
    // SHEEP-308: Check if policy evaluation is configured
    if (!this.deps.policyEngine || !this.deps.policyConfig) {
      return null; // Policy evaluation not enabled
    }

    // Delegate to PolicyEngine
    return await this.deps.policyEngine.evaluate(
      envelope,
      replyPlan,
      this.deps.policyConfig,
    );
  }

  /**
   * Build ContractIdentityLock from InboundTurn.identity_lock.
   *
   * Maps Domain Layer (InboundTurnIdentityLock) to Contract Schema (ContractIdentityLock).
   * InboundTurnIdentityLock uses camelCase; ContractIdentityLock uses snake_case.
   */
  private buildContractIdentityLock(turn: InboundTurn): ContractIdentityLock {
    const lock = turn.identity_lock;

    // Build customer_identity (PDD uses customerUid)
    const customerIdentity: ContractCustomerIdentity = {
      kind: "customerUid",
      value: lock.customerId ?? "unknown",
    };

    // Build trigger_message reference
    const triggerMessageId = turn.source_message_ids[0] ?? `trigger_${turn.turn_id}`;

    return {
      merchant_id: lock.merchantId,
      store_id: lock.storeId,
      platform: lock.platform as ContractIdentityLock["platform"],
      platform_account_id: lock.platformAccountId,
      customer_identity: customerIdentity,
      conversation_id: lock.conversationId,
      trigger_message_id: triggerMessageId,
    };
  }

  /**
   * Build ContractTriggerMessage from InboundTurn.
   *
   * Extracts the first source message as the trigger message.
   */
  private buildTriggerMessage(turn: InboundTurn): ContractTriggerMessage {
    const messageId = turn.source_message_ids[0] ?? `msg_${turn.turn_id}`;
    const receivedAt = turn.source_observed_at[0] ?? turn.created_at;

    return {
      message_id: messageId,
      content: "", // Content is not stored in InboundTurn; would need to fetch from message store
      received_at: receivedAt ?? turn.created_at,
    };
  }

  /**
   * Retrieve knowledge from StoreKnowledgeRetrievalPort.
   *
   * MVP: Extract keywords from trigger message and query StoreKnowledge.
   * Maps StoreKnowledgeEntry to RetrievedKnowledge.
   */
  private async retrieveKnowledge(
    identityLock: ContractIdentityLock,
    turn: InboundTurn,
    scene: string,
  ): Promise<RetrievedKnowledge[]> {
    // SHEEP-305: Get knowledge filter from scene
    const knowledgeFilter = getKnowledgeFilter(scene);

    // MVP: Extract simple keywords from turn_id (placeholder)
    // In production, this would extract keywords from the actual message content
    const keywords = this.extractKeywords(turn);

    // Build query params with optional knowledge_type filter
    const queryParams: Parameters<StoreKnowledgeRetrievalPort["query"]>[0] = {
      merchant_id: identityLock.merchant_id,
      store_id: identityLock.store_id,
      keywords,
      status: "ACTIVE",
      limit: 20,
    };

    // SHEEP-305: Apply scene-based knowledge type filter
    // storeKnowledgeType maps to the port's knowledge_type (Layer 2 / DB-level)
    if (knowledgeFilter.storeKnowledgeType) {
      (queryParams as { knowledge_type?: string }).knowledge_type = knowledgeFilter.storeKnowledgeType;
    }

    // If no keywords and no filter, skip retrieval (backward compatible)
    if (keywords.length === 0 && !knowledgeFilter.storeKnowledgeType) {
      return [];
    }

    const result = await this.deps.knowledgePort.query(queryParams);

    if (!result.ok) {
      return [];
    }

    // Map StoreKnowledgeEntry to RetrievedKnowledge
    return result.entries.map((entry) => this.mapToRetrievedKnowledge(entry, keywords));
  }

  /**
   * Extract keywords from InboundTurn.
   *
   * MVP: Simple placeholder implementation.
   * In production, this would use NLP or extract from message content.
   */
  private extractKeywords(turn: InboundTurn): string[] {
    // MVP: Return empty array (no keyword extraction yet)
    // Future: Extract from message content using NLP or simple heuristics
    return [];
  }

  /**
   * Map StoreKnowledgeEntry to RetrievedKnowledge.
   *
   * Adds relevance_score and matched_keywords (MVP: simple defaults).
   */
  private mapToRetrievedKnowledge(
    entry: StoreKnowledgeEntry,
    matchedKeywords: string[],
  ): RetrievedKnowledge {
    return {
      knowledge_id: entry.id,
      knowledge_type: "STORE_RULE", // Layer 1: all StoreKnowledge is STORE_RULE
      store_knowledge_type: entry.knowledge_type, // Layer 2: SHIPPING_TIME, RETURN_POLICY, etc.
      title: entry.title,
      content: entry.content,
      relevance_score: 1.0, // MVP: all retrieved knowledge has score 1.0
      matched_keywords: matchedKeywords,
    };
  }
}

/**
 * Factory function for creating a ContextEnvelopeBuilder.
 *
 * @param deps - Builder dependencies
 * @returns A new ContextEnvelopeBuilder instance
 */
export function createContextEnvelopeBuilder(deps: ContextEnvelopeBuilderDeps): ContextEnvelopeBuilder {
  return new ContextEnvelopeBuilder(deps);
}
