/**
 * Scene → ContextEnvelope Adapter (SHEEP-306, P1-7a).
 *
 * Purpose: Adapt MinimalSceneClassifier output (SceneClassification) to
 * ContextEnvelope's scene field format.
 *
 * Governance basis:
 * - SHEEP-304: MINIMAL_V1 scene contract (bounded vocabulary).
 * - SHEEP-306: ContextEnvelope requires scene field as string.
 *
 * Key invariants:
 * - Pure function, no side effects.
 * - Preserves MINIMAL_V1 bounded vocabulary (SHIPPING_TIME | OTHER_UNSUPPORTED | UNKNOWN).
 * - Does NOT extend scene vocabulary (second scene is OPEN_DECISION).
 * - Does NOT modify minimal-scene-classifier.ts.
 *
 * Owner SHEEP-306 decisions:
 * D1: Scene adapter is a pure mapping function, not a classifier.
 * D2: Scene vocabulary remains bounded by MINIMAL_V1 contract.
 * D3: ContextEnvelope.scene is a string, directly mapped from MinimalScene.
 */

import type { SceneClassification, MinimalScene } from "./minimal-scene-classifier.js";

/**
 * Adapt SceneClassification to ContextEnvelope scene field.
 *
 * Mapping:
 * - SHIPPING_TIME → "SHIPPING_TIME"
 * - OTHER_UNSUPPORTED → "OTHER_UNSUPPORTED"
 * - UNKNOWN → "UNKNOWN"
 *
 * This is a direct identity mapping because MinimalScene values already
 * match the expected ContextEnvelope scene vocabulary.
 *
 * @param classification - The SceneClassification from MinimalSceneClassifier
 * @returns The scene string value for ContextEnvelope
 */
export function adaptSceneToEnvelope(classification: SceneClassification): string {
  // Direct mapping: MinimalScene values are already valid scene strings.
  // The type system guarantees classification.scene is one of the 3 MinimalScene values.
  return classification.scene;
}

/**
 * Validate that a scene string is a valid MinimalScene value.
 *
 * This is useful when constructing ContextEnvelope from external sources
 * and we need to verify the scene is within the bounded vocabulary.
 *
 * @param scene - The scene string to validate
 * @returns true if the scene is a valid MinimalScene value
 */
export function isValidEnvelopeScene(scene: string): scene is MinimalScene {
  const validScenes: readonly MinimalScene[] = [
    "SHIPPING_TIME",
    "OTHER_UNSUPPORTED",
    "UNKNOWN",
  ];
  return validScenes.includes(scene as MinimalScene);
}

/**
 * Extract scene classification metadata for ContextEnvelope diagnostics.
 *
 * This function extracts relevant metadata from SceneClassification that
 * may be useful for ContextEnvelope's explicit_unknowns or tracing.
 *
 * @param classification - The SceneClassification from MinimalSceneClassifier
 * @returns Metadata object with classification details
 */
export function extractSceneMetadata(classification: SceneClassification): {
  readonly contract: string;
  readonly reason: string;
  readonly ruleId: string | null;
  readonly automaticProcessingEligible: boolean;
  readonly diagnostics: readonly string[];
} {
  return {
    contract: classification.contract,
    reason: classification.reason,
    ruleId: classification.ruleId,
    automaticProcessingEligible: classification.automaticProcessingEligible,
    diagnostics: classification.diagnostics,
  };
}
