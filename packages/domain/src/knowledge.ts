/**
 * Knowledge Type Filtering Domain (SHEEP-305 子任务 5).
 *
 * Maps conversation scenes to knowledge types for RAG retrieval filtering.
 * This TypeScript module mirrors the Python `scene_knowledge_mapping.py` module,
 * ensuring type safety across the TypeScript/Python boundary.
 *
 * Key invariants:
 * - Scene mapping must stay in sync with Python side.
 * - Unknown scenes fall back to "ALL" (no filtering) for backward compatibility.
 * - knowledge_type="ALL" means no filtering — callers should omit the filter field.
 *
 * Reuses KnowledgeType and StoreKnowledgeType from context-envelope.ts.
 * Adds "ALL" as a sentinel for the default (no-filter) case.
 *
 * Owner SHEEP-305 decisions:
 * D1: SHIPPING_TIME is a regular store knowledge type (vector retrieval, same as enterprise knowledge).
 * D2: Scene routing is a filter, not a separate retrieval path.
 * D3: Backward compatibility — no scene means no filter.
 */

import type { KnowledgeType, StoreKnowledgeType } from "./context-envelope.js";

/**
 * Extended knowledge type for filter results.
 * "ALL" is a sentinel meaning "no filtering" — retrieve all knowledge types.
 * This is distinct from the contract KnowledgeType which only has
 * "PRODUCT_KNOWLEDGE" | "STORE_RULE".
 */
export type KnowledgeFilterType = KnowledgeType | "ALL";

/**
 * Recognized conversation scenes.
 * Each scene maps to a specific knowledge filter.
 */
export type RecognizedScene =
  | "SHIPPING_TIME"
  | "RETURN_POLICY"
  | "PRODUCT_INQUIRY"
  | "FAQ";

/**
 * Knowledge filter result from scene mapping.
 * When knowledgeType is "ALL", storeKnowledgeType is undefined (no filtering).
 */
export interface KnowledgeFilter {
  /** High-level knowledge type. "ALL" means no filtering. */
  readonly knowledgeType: KnowledgeFilterType;
  /** Specific store knowledge sub-type. undefined means no sub-type filtering. */
  readonly storeKnowledgeType: StoreKnowledgeType | undefined;
}

/**
 * Scene → KnowledgeFilter mapping.
 * Must stay in sync with Python SCENE_KNOWLEDGE_MAPPING.
 */
const SCENE_KNOWLEDGE_MAPPING: Record<RecognizedScene, KnowledgeFilter> = {
  SHIPPING_TIME: { knowledgeType: "STORE_RULE", storeKnowledgeType: "SHIPPING_TIME" },
  RETURN_POLICY: { knowledgeType: "STORE_RULE", storeKnowledgeType: "RETURN_POLICY" },
  PRODUCT_INQUIRY: { knowledgeType: "PRODUCT_KNOWLEDGE", storeKnowledgeType: undefined },
  FAQ: { knowledgeType: "STORE_RULE", storeKnowledgeType: "FAQ" },
};

/**
 * Default filter when scene is not recognized or not provided.
 * Returns "ALL" which means no filtering — backward compatible.
 */
const DEFAULT_FILTER: KnowledgeFilter = {
  knowledgeType: "ALL",
  storeKnowledgeType: undefined,
};

/**
 * Get knowledge filter for a given scene.
 *
 * Maps a conversation scene to the appropriate knowledge type filters
 * for RAG retrieval. The filters are used to narrow down the search
 * to relevant knowledge entries.
 *
 * @param scene - Scene identifier (e.g., "SHIPPING_TIME", "RETURN_POLICY").
 *                Can be undefined or an unrecognized value.
 * @returns KnowledgeFilter with knowledgeType and storeKnowledgeType.
 *
 * @example
 * ```ts
 * const filter = getKnowledgeFilter("SHIPPING_TIME");
 * // Returns: { knowledgeType: "STORE_RULE", storeKnowledgeType: "SHIPPING_TIME" }
 *
 * const defaultFilter = getKnowledgeFilter(undefined);
 * // Returns: { knowledgeType: "ALL", storeKnowledgeType: undefined }
 * ```
 */
export function getKnowledgeFilter(scene: string | undefined): KnowledgeFilter {
  if (!scene) {
    return DEFAULT_FILTER;
  }
  if (isRecognizedScene(scene)) {
    return SCENE_KNOWLEDGE_MAPPING[scene];
  }
  return DEFAULT_FILTER;
}

/**
 * Type guard: check if a string is a recognized scene.
 */
export function isRecognizedScene(scene: string): scene is RecognizedScene {
  return scene in SCENE_KNOWLEDGE_MAPPING;
}

/**
 * Get all recognized scene identifiers.
 */
export function getAllScenes(): RecognizedScene[] {
  return Object.keys(SCENE_KNOWLEDGE_MAPPING) as RecognizedScene[];
}

/**
 * Check if a knowledge filter represents the default (no filtering) state.
 * Useful for backward compatibility — callers can skip passing filters
 * when this returns true.
 */
export function isDefaultFilter(filter: KnowledgeFilter): boolean {
  return filter.knowledgeType === "ALL" && filter.storeKnowledgeType === undefined;
}
