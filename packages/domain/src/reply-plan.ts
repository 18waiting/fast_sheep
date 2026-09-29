/**
 * ReplyPlan Domain (SHEEP-306, Phase 1).
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - DEC-SHEEP-306: ReplyPlan is the canonical AI output format.
 * - Evolution path: Suggestion → ReplyPlan.
 *
 * Key invariants:
 * - AI output is a plan, not execution authority.
 * - Facts, knowledge, and inference are structurally distinguished.
 * - AI inference MUST NOT silently become an authoritative fact.
 * - Verification requirements are explicit.
 * - Policy metadata governs execution path.
 *
 * Owner SHEEP-306 decisions:
 * D1: ReplyPlan is the canonical evolution of Suggestion; no competing models.
 * D2: Verification is structural, not optional.
 * D3: Inference must be distinguished from facts.
 *
 * **Contract Schema Types — Not Domain Layer Types**
 *
 * These TypeScript types mirror the JSON Schema definitions in
 * `resources/contracts/schemas/domain/reply-plan.schema.json`.
 * They use flat strings with snake_case naming, distinct from the
 * Domain Layer types which use richer type information.
 */

import type {
  ContractIdentityLock,
  ContractTriggerMessage,
  KnowledgeType,
  StoreKnowledgeType,
  RolloutMode,
} from "./context-envelope.js";

/**
 * ReplyContent: Structured reply content.
 */
export interface ReplyContent {
  readonly text: string;
  readonly language: string; // e.g., "zh-CN"
  readonly segments?: ReplySegment[];
}

/**
 * ReplySegment: A structured segment of the reply.
 */
export interface ReplySegment {
  readonly segment_type: "text" | "greeting" | "answer" | "closing" | "disclaimer";
  readonly content: string;
  readonly fact_refs?: string[];
  readonly knowledge_refs?: string[];
}

/**
 * FactReference: Reference to an authoritative fact used in the reply.
 */
export interface FactReference {
  readonly fact_id: string;
  readonly fact_key: string; // e.g., "shop_facts.shipping_policy"
  readonly source:
    | "platform_api"
    | "merchant_config"
    | "store_knowledge"
    | "product_knowledge"
    | "order_system"
    | "logistics_system";
  readonly value_snapshot?: unknown;
  readonly retrieved_at?: string; // ISO 8601 datetime
}

/**
 * KnowledgeReference: Reference to retrieved knowledge used in the reply.
 */
export interface KnowledgeReference {
  readonly knowledge_id: string;
  readonly knowledge_type: KnowledgeType;
  readonly store_knowledge_type?: StoreKnowledgeType;
  readonly title?: string;
  readonly content_snapshot?: string;
  readonly relevance_score: number; // 0.0 to 1.0
}

/**
 * InferenceReference: Reference to an AI inference used in the reply.
 * MUST be distinguished from facts.
 */
export interface InferenceReference {
  readonly inference_id: string;
  readonly inference_type:
    | "intent_classification"
    | "sentiment_analysis"
    | "entity_extraction"
    | "summarization"
    | "paraphrase";
  readonly description: string;
  readonly confidence: number; // 0.0 to 1.0
  readonly based_on?: string[]; // Fact/knowledge IDs this inference is based on
}

/**
 * PolicyMetadata: Policy-relevant metadata governing execution path.
 */
export interface PolicyMetadata {
  readonly rollout_mode: RolloutMode;
  readonly requires_confirmation?: boolean;
  readonly confirmation_reason?: string;
  readonly risk_level?: "low" | "medium" | "high";
  readonly applicable_policies?: string[];
}

/**
 * RequiredVerification: A required pre-execution verification.
 */
export interface RequiredVerification {
  readonly verification_id: string;
  readonly category:
    | "identity_lock"
    | "fact_freshness"
    | "target_binding"
    | "stale_selection"
    | "cross_shop_check";
  readonly description: string;
  readonly blocking?: boolean; // default: true
}

/**
 * VerificationRequirements: Pre-execution verification requirements.
 */
export interface VerificationRequirements {
  readonly identity_lock_valid: boolean;
  readonly facts_validated: boolean;
  readonly required_verifications?: RequiredVerification[];
}

/**
 * PlanUnknown: Unknown that affects execution authorization.
 */
export interface PlanUnknown {
  readonly unknown_id: string;
  readonly category:
    | "missing_identity"
    | "missing_fact"
    | "contradictory_facts"
    | "stale_evidence"
    | "unresolved_scene"
    | "low_confidence_inference";
  readonly description: string;
  readonly blocking?: boolean; // default: true
  readonly mitigation?: string; // e.g., "request human review"
}

/**
 * ReplyPlan: Structured output from AI (Contract Schema format).
 * AI output is a plan, not execution authority.
 */
export interface ReplyPlan {
  readonly plan_id: string;
  readonly envelope_ref: string; // Reference to ContextEnvelope
  readonly identity_lock: ContractIdentityLock; // Inherited from envelope
  readonly scene: string; // Inherited from envelope
  readonly trigger_message: ContractTriggerMessage; // Inherited from envelope
  readonly reply_content: ReplyContent;
  readonly fact_references?: FactReference[];
  readonly knowledge_references?: KnowledgeReference[];
  readonly inference_references?: InferenceReference[];
  readonly policy_metadata?: PolicyMetadata;
  readonly verification_requirements: VerificationRequirements;
  readonly unknowns?: PlanUnknown[];
  readonly created_at: string; // ISO 8601 datetime
}
