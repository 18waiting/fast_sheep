// SHEEP-304 Minimal Scene Contract (MINIMAL_V1) + deterministic classifier boundary.
//
// Authority: Roadmap V1.1 "SHEEP-304 — Minimal Scene Contract" (goal: create MINIMAL_V1 scene
// classification for SHIPPING_TIME, OTHER/UNSUPPORTED and UNKNOWN; allowed scope: scene contract and
// deterministic classifier boundary; must not build a broad intent taxonomy or implement the second
// scene) + docs/product/PDD_MVP_V1.md section 2 (confirmed first scene SHIPPING_TIME; second scene
// OPEN_DECISION; do not close it without explicit Owner approval).
//
// Boundaries kept by construction:
// - The result vocabulary is BOUNDED and enforced at runtime, not only in types.
// - UNKNOWN and OTHER_UNSUPPORTED are always safe paths: neither implies automation, and every
//   classification carries automaticProcessingEligible = false and newness = NEWNESS_UNVERIFIED.
// - The classifier owns no AI, send, persistence or platform port; it is a pure deterministic
//   function of (identity-locked turn, resolved message texts, registered rules).
// - The SHIPPING_TIME rule semantics are NOT decided here: SHEEP-305 owns that rule and it is gated
//   by SHIPPING_TIME_RULE_SEMANTICS = PRODUCT_DECISION_REQUIRED. With no approved rule registered the
//   classifier therefore never emits SHIPPING_TIME.
// - The second scene stays OPEN_DECISION: no second-scene value exists in the vocabulary, and a rule
//   claiming a value outside the vocabulary is refused instead of inventing a scene.
//
// Placement note: the contract lives in this versioned Main-side module (types + runtime validator)
// so this unit does not touch the frozen canonical schema registry. Promoting it into
// packages/contracts/schemas is a separate governed step, not part of SHEEP-304.

import type { InboundTurn, InboundTurnIdentityLock } from "./inbound-turn-builder.js";

export const SCENE_CONTRACT_ID = "MINIMAL_V1" as const;

/** Bounded MINIMAL_V1 result vocabulary. Nothing else may ever be produced. */
export type MinimalScene = "SHIPPING_TIME" | "OTHER_UNSUPPORTED" | "UNKNOWN";

export const MINIMAL_V1_SCENES: readonly MinimalScene[] = Object.freeze([
  "SHIPPING_TIME",
  "OTHER_UNSUPPORTED",
  "UNKNOWN",
]);

/** Runtime enforcement of the bounded vocabulary. */
export function isMinimalScene(value: unknown): value is MinimalScene {
  return typeof value === "string" && (MINIMAL_V1_SCENES as readonly string[]).includes(value);
}

/** Confirmed first reply scene (PDD_MVP_V1 section 2). */
export const FIRST_REPLY_SCENE: MinimalScene = "SHIPPING_TIME";
/** The second scene is an open product decision and must not be closed by this unit. */
export const SECOND_SCENE_DECISION = "OPEN_DECISION" as const;

export type SceneClassificationReason =
  | "NO_SOURCE_MESSAGES"
  | "IDENTITY_INCOMPLETE"
  | "CONTENT_UNAVAILABLE"
  | "CONTENT_EMPTY"
  | "INVALID_RULE_SCENE"
  | "NO_APPROVED_RULE"
  | "APPROVED_RULE_MATCHED";

export type SceneClassificationDiagnostic =
  | "SECOND_SCENE_OPEN_DECISION"
  | "SHIPPING_TIME_RULE_PENDING_PRODUCT_DECISION"
  | "CLASSIFIER_TRIGGERS_NO_SEND"
  | "MESSAGES_OUTSIDE_TURN_IGNORED";

/** Deterministic rule seam. SHEEP-305 registers the approved SHIPPING_TIME rule here. */
export interface SceneRule {
  readonly ruleId: string;
  readonly scene: MinimalScene;
  matches(messageTexts: readonly string[]): boolean;
}

/** Resolved content facts for one source message of the turn (read back from canonical persistence). */
export interface SceneMessageFact {
  readonly messageId: string;
  readonly contentText: string | null;
}

export interface SceneClassificationInput {
  readonly turn: InboundTurn;
  readonly messages: readonly SceneMessageFact[];
}

export interface SceneClassification {
  readonly contract: typeof SCENE_CONTRACT_ID;
  readonly scene: MinimalScene;
  readonly turn_id: string;
  readonly identity_lock: InboundTurnIdentityLock;
  readonly source_message_ids: readonly string[];
  readonly ruleId: string | null;
  readonly reason: SceneClassificationReason;
  readonly decidedBy: "DETERMINISTIC_CLASSIFIER";
  readonly newness: "NEWNESS_UNVERIFIED";
  readonly automaticProcessingEligible: false;
  readonly secondSceneDecision: typeof SECOND_SCENE_DECISION;
  readonly diagnostics: readonly SceneClassificationDiagnostic[];
}

export interface MinimalSceneClassifier {
  classify(input: SceneClassificationInput): SceneClassification;
  diagnostics(): {
    readonly contract: typeof SCENE_CONTRACT_ID;
    readonly registeredRules: number;
    readonly rejectedRules: number;
    readonly classified: number;
    readonly byScene: Readonly<Record<MinimalScene, number>>;
    readonly aiCalls: 0;
    readonly sendCalls: 0;
    readonly persistenceWrites: 0;
    readonly sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT";
  };
}

const IDENTITY_FIELDS: readonly (keyof InboundTurnIdentityLock)[] = [
  "platform", "merchantId", "storeId", "platformAccountId", "conversationId",
];

function incompleteIdentity(lock: InboundTurnIdentityLock): boolean {
  return IDENTITY_FIELDS.some((field) => typeof lock?.[field] !== "string" || String(lock[field]).trim().length === 0);
}

function textForSourceMessage(ids: readonly string[], facts: readonly SceneMessageFact[]): { texts: string[]; missing: boolean; empty: boolean } {
  const byId = new Map(facts.map((fact) => [fact.messageId, fact]));
  const texts: string[] = [];
  let missing = false;
  let empty = false;
  for (const id of ids) {
    const fact = byId.get(id);
    if (!fact || typeof fact.contentText !== "string") { missing = true; continue; }
    if (fact.contentText.trim().length === 0) { empty = true; continue; }
    texts.push(fact.contentText);
  }
  return { texts, missing, empty };
}

export function createMinimalSceneClassifier(options: { readonly rules?: readonly SceneRule[] } = {}): MinimalSceneClassifier {
  const accepted: SceneRule[] = [];
  let rejectedRules = 0;
  for (const rule of options.rules ?? []) {
    if (!isMinimalScene(rule.scene)) { rejectedRules += 1; continue; }
    accepted.push(rule);
  }
  const byScene: Record<MinimalScene, number> = { SHIPPING_TIME: 0, OTHER_UNSUPPORTED: 0, UNKNOWN: 0 };
  let classified = 0;

  const base = (input: SceneClassificationInput) => {
    const diagnostics: SceneClassificationDiagnostic[] = ["SECOND_SCENE_OPEN_DECISION", "CLASSIFIER_TRIGGERS_NO_SEND"];
    if (accepted.length === 0) diagnostics.push("SHIPPING_TIME_RULE_PENDING_PRODUCT_DECISION");
    const knownIds = new Set(input.turn.source_message_ids);
    if (input.messages.some((fact) => !knownIds.has(fact.messageId))) diagnostics.push("MESSAGES_OUTSIDE_TURN_IGNORED");
    const sceneOf = (scene: MinimalScene, reason: SceneClassificationReason, ruleId: string | null): SceneClassification => {
      byScene[scene] += 1;
      classified += 1;
      return Object.freeze({
        contract: SCENE_CONTRACT_ID,
        scene,
        turn_id: input.turn.turn_id,
        identity_lock: input.turn.identity_lock,
        source_message_ids: input.turn.source_message_ids,
        ruleId,
        reason,
        decidedBy: "DETERMINISTIC_CLASSIFIER" as const,
        newness: "NEWNESS_UNVERIFIED" as const,
        automaticProcessingEligible: false as const,
        secondSceneDecision: SECOND_SCENE_DECISION,
        diagnostics: Object.freeze(diagnostics),
      });
    };

    if (incompleteIdentity(input.turn.identity_lock)) return sceneOf("UNKNOWN", "IDENTITY_INCOMPLETE", null);
    if (input.turn.source_message_ids.length === 0) return sceneOf("UNKNOWN", "NO_SOURCE_MESSAGES", null);
    const { texts, missing, empty } = textForSourceMessage(input.turn.source_message_ids, input.messages);
    if (missing) return sceneOf("UNKNOWN", "CONTENT_UNAVAILABLE", null);
    if (empty || texts.length === 0) return sceneOf("UNKNOWN", "CONTENT_EMPTY", null);
    for (const rule of accepted) {
      if (rule.matches(texts)) return sceneOf(rule.scene, "APPROVED_RULE_MATCHED", rule.ruleId);
    }
    return sceneOf("OTHER_UNSUPPORTED", "NO_APPROVED_RULE", null);
  };

  return {
    classify(input: SceneClassificationInput): SceneClassification {
      return base(input);
    },
    diagnostics() {
      return {
        contract: SCENE_CONTRACT_ID,
        registeredRules: accepted.length,
        rejectedRules,
        classified,
        byScene: { ...byScene },
        aiCalls: 0,
        sendCalls: 0,
        persistenceWrites: 0,
        sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT" as const,
      };
    },
  };
}
