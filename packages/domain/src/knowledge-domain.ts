// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-305 (RAG Knowledge Base Infrastructure): Domain types for the unified
// knowledge retrieval infrastructure. Aligned with DEC-008 (Layered Knowledge).

// ─── Knowledge Layers (DEC-008) ─────────────────────────────────────────────

/**
 * Knowledge layers per DEC-008.
 * Each layer has its own storage and retrieval scope.
 */
export type KnowledgeLayer =
  | "SYSTEM"        // Layer 1: System/Platform rules (global)
  | "MERCHANT"      // Layer 2: Merchant-wide rules
  | "STORE"         // Layer 3: Store-specific rules
  | "PRODUCT"       // Layer 4: Product-specific rules
  | "CONVERSATION"; // Layer 5: Conversation temporary context

// ─── Scene Types ─────────────────────────────────────────────────────────────

/**
 * Query scenes that route to specific knowledge types.
 * Scenes represent the buyer's intent or the context of the question.
 */
export type SceneType =
  | "SHIPPING_TIME"       // 发货时间相关咨询
  | "PRODUCT_INQUIRY"     // 商品规格/属性咨询
  | "RETURN_POLICY"       // 退换货政策咨询
  | "ORDER_STATUS"        // 订单状态咨询
  | "LOGISTICS"           // 物流相关咨询
  | "FAQ"                 // 常见问题
  | "GENERAL";            // 通用咨询（兜底）

// ─── Knowledge Types ─────────────────────────────────────────────────────────

/**
 * Definition of a registered knowledge type.
 * New types can be registered without code changes (open for extension).
 */
export interface KnowledgeTypeDefinition {
  /** Unique type identifier (e.g., "SHIPPING_TIME") */
  readonly type: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Which knowledge layer this type belongs to */
  readonly layer: KnowledgeLayer;

  /** Which scenes this type can answer */
  readonly scenes: readonly SceneType[];

  /** Whether this type is currently active */
  readonly active: boolean;

  /** Optional description for documentation */
  readonly description?: string;
}

// ─── Store Knowledge Entry ───────────────────────────────────────────────────

/**
 * A store knowledge entry (DEC-008 layer 3).
 * Matches the store-knowledge.schema.json contract.
 */
export interface StoreKnowledgeEntry {
  readonly id: string;
  readonly merchant_id: string;
  readonly store_id: string;
  readonly knowledge_type: string;
  readonly title: string;
  readonly content: string;
  readonly tags?: readonly string[];
  readonly source?: "OWNER_INPUT" | "IMPORTED";
  readonly status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  readonly created_at: string;
  readonly updated_at: string;
}

// ─── Knowledge Query ─────────────────────────────────────────────────────────

/**
 * A knowledge retrieval query.
 * Used as input to the unified retrieval interface.
 */
export interface KnowledgeQuery {
  /** Merchant scope (required) */
  readonly merchantId: string;

  /** Store scope (required for Store layer queries) */
  readonly storeId?: string;

  /** Product scope (required for Product layer queries) */
  readonly productId?: string;

  /** The scene being queried (determines which knowledge types to search) */
  readonly scene: SceneType;

  /** Keywords extracted from the buyer's message */
  readonly keywords: readonly string[];

  /** Maximum number of results to return (default: 20) */
  readonly limit?: number;
}

// ─── Knowledge Retrieval Result ──────────────────────────────────────────────

/**
 * Result from the unified knowledge retrieval interface.
 */
export interface KnowledgeRetrievalResult {
  /** Matched knowledge entries */
  readonly entries: readonly StoreKnowledgeEntry[];

  /** Confidence score (0-1) based on match quality */
  readonly confidence: number;

  /** Which retrieval method was used */
  readonly retrievalMethod: "KEYWORD" | "VECTOR" | "HYBRID";

  /** Which knowledge types were searched */
  readonly searchedTypes: readonly string[];

  /** Whether any results were found */
  readonly hasResults: boolean;
}

// ─── Knowledge Type Registry ─────────────────────────────────────────────────

/**
 * Registry for knowledge types.
 * Supports registering new types without code changes.
 */
export interface KnowledgeTypeRegistry {
  /** Register a new knowledge type */
  register(definition: KnowledgeTypeDefinition): void;

  /** Get a knowledge type by its type identifier */
  getType(type: string): KnowledgeTypeDefinition | undefined;

  /** Get all knowledge types that can handle a given scene */
  getTypesForScene(scene: SceneType): readonly KnowledgeTypeDefinition[];

  /** Get all registered knowledge types */
  getAllTypes(): readonly KnowledgeTypeDefinition[];

  /** Check if a knowledge type is registered */
  hasType(type: string): boolean;
}

// ─── Knowledge Retrieval Service ─────────────────────────────────────────────

/**
 * Unified knowledge retrieval service.
 * Single entry point for all knowledge queries.
 */
export interface KnowledgeRetrievalService {
  /**
   * Retrieve knowledge entries matching the query.
   * Routes to appropriate knowledge types based on scene.
   */
  retrieve(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult>;
}

// ─── Built-in Knowledge Types ────────────────────────────────────────────────

/**
 * Built-in knowledge type definitions.
 * These are registered by default in the KnowledgeTypeRegistry.
 */
export const BUILTIN_KNOWLEDGE_TYPES: readonly KnowledgeTypeDefinition[] = [
  {
    type: "SHIPPING_TIME",
    displayName: "发货时间规则",
    layer: "STORE",
    scenes: ["SHIPPING_TIME"],
    active: true,
    description: "商家配置的发货时间规则，包括发货时限、特殊情况等",
  },
  {
    type: "RETURN_POLICY",
    displayName: "退换货政策",
    layer: "STORE",
    scenes: ["RETURN_POLICY"],
    active: true,
    description: "商家配置的退换货政策",
  },
  {
    type: "FAQ",
    displayName: "常见问题",
    layer: "STORE",
    scenes: ["FAQ", "GENERAL"],
    active: true,
    description: "商家配置的常见问题解答",
  },
  {
    type: "OTHER",
    displayName: "其他知识",
    layer: "STORE",
    scenes: ["GENERAL"],
    active: true,
    description: "其他类型的店铺知识",
  },
] as const;
