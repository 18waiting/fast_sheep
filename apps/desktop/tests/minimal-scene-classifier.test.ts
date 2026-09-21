// SHEEP-304 focused tests: MINIMAL_V1 scene contract and the deterministic classifier boundary.
// Roadmap exit criteria -> tests:
//   1. result vocabulary is bounded                      -> vocabulary + runtime validator tests
//   2. unsupported and unknown remain safe paths         -> UNKNOWN/OTHER_UNSUPPORTED suites
//   3. classifier cannot trigger send                    -> structural + output tests
//   4. second scene remains OPEN_DECISION                -> vocabulary + invalid-rule tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { VirtualClock } from "@fastwork/test-kit";
import {
  createMinimalSceneClassifier,
  isMinimalScene,
  MINIMAL_V1_SCENES,
  SCENE_CONTRACT_ID,
  SECOND_SCENE_DECISION,
} from "../dist/main/services/minimal-scene-classifier.js";
import {
  createInboundTurnBuilder,
  TURN_QUIET_WINDOW_DEFAULT_MS,
} from "../dist/main/services/inbound-turn-builder.js";

const IDENTITY = Object.freeze({
  platform: "pdd",
  merchantId: "merchant-1",
  storeId: "store-1",
  platformAccountId: "account-1",
  conversationId: "conversation:account-1:2318082461",
  customerId: "2318082461",
});

function turn(overrides = {}) {
  return {
    turn_id: "turn-pdd-000001",
    identity_lock: IDENTITY,
    source_message_ids: ["m-1"],
    source_observed_at: ["2026-09-22T00:00:00.000Z"],
    created_at: "2026-09-22T00:00:04.000Z",
    newness: "NEWNESS_UNVERIFIED",
    automaticProcessingEligible: false,
    ...overrides,
  };
}

test("contract: the MINIMAL_V1 result vocabulary is bounded and enforced at runtime", () => {
  assert.equal(SCENE_CONTRACT_ID, "MINIMAL_V1");
  assert.deepEqual([...MINIMAL_V1_SCENES], ["SHIPPING_TIME", "OTHER_UNSUPPORTED", "UNKNOWN"]);
  assert.equal(Object.isFrozen(MINIMAL_V1_SCENES), true, "the vocabulary must not be mutable");
  for (const value of MINIMAL_V1_SCENES) assert.equal(isMinimalScene(value), true);
  // No second scene value exists: the decision stays open.
  assert.equal(isMinimalScene("LOGISTICS"), false);
  assert.equal(isMinimalScene(""), false);
  assert.equal(isMinimalScene(null), false);
  assert.equal(SECOND_SCENE_DECISION, "OPEN_DECISION");
});

test("no approved rule: a well-formed question becomes OTHER_UNSUPPORTED with the pending-decision reason", () => {
  const classifier = createMinimalSceneClassifier();
  const result = classifier.classify({ turn: turn(), messages: [{ messageId: "m-1", contentText: "什么时候发货" }] });
  assert.equal(result.scene, "OTHER_UNSUPPORTED");
  assert.equal(result.reason, "NO_APPROVED_RULE");
  assert.equal(result.ruleId, null);
  assert.deepEqual([...result.diagnostics], [
    "SECOND_SCENE_OPEN_DECISION", "CLASSIFIER_TRIGGERS_NO_SEND", "SHIPPING_TIME_RULE_PENDING_PRODUCT_DECISION",
  ]);
  assert.equal(result.decidedBy, "DETERMINISTIC_CLASSIFIER");
  assert.equal(result.secondSceneDecision, "OPEN_DECISION");
});

test("multi-question turn: every source id is carried through in order (no message is dropped)", () => {
  const classifier = createMinimalSceneClassifier();
  const result = classifier.classify({
    turn: turn({ source_message_ids: ["m-1", "m-2", "m-3"] }),
    messages: [
      { messageId: "m-3", contentText: "什么时候发货" },
      { messageId: "m-1", contentText: "你好" },
      { messageId: "m-2", contentText: "我想问一下" },
    ],
  });
  assert.deepEqual([...result.source_message_ids], ["m-1", "m-2", "m-3"], "turn order is preserved, not message order");
  assert.equal(result.scene, "OTHER_UNSUPPORTED");
});

test("unknown stays unknown: missing content is never guessed", () => {
  const classifier = createMinimalSceneClassifier();
  const missing = classifier.classify({ turn: turn(), messages: [] });
  assert.equal(missing.scene, "UNKNOWN");
  assert.equal(missing.reason, "CONTENT_UNAVAILABLE");
  const blank = classifier.classify({ turn: turn(), messages: [{ messageId: "m-1", contentText: "   " }] });
  assert.equal(blank.scene, "UNKNOWN");
  assert.equal(blank.reason, "CONTENT_EMPTY");
  const nullText = classifier.classify({ turn: turn(), messages: [{ messageId: "m-1", contentText: null }] });
  assert.equal(nullText.scene, "UNKNOWN");
  assert.equal(nullText.reason, "CONTENT_UNAVAILABLE");
});

test("incomplete identity fails closed to UNKNOWN (no cross-scope classification)", () => {
  const classifier = createMinimalSceneClassifier();
  for (const field of ["platform", "merchantId", "storeId", "platformAccountId", "conversationId"]) {
    const broken = classifier.classify({
      turn: turn({ identity_lock: { ...IDENTITY, [field]: "" } }),
      messages: [{ messageId: "m-1", contentText: "什么时候发货" }],
    });
    assert.equal(broken.scene, "UNKNOWN", field);
    assert.equal(broken.reason, "IDENTITY_INCOMPLETE", field);
  }
  const noMessages = classifier.classify({ turn: turn({ source_message_ids: [] }), messages: [] });
  assert.equal(noMessages.scene, "UNKNOWN");
  assert.equal(noMessages.reason, "NO_SOURCE_MESSAGES");
});

test("messages that do not belong to the turn are ignored (no bleed from another conversation)", () => {
  const classifier = createMinimalSceneClassifier({
    rules: [{ ruleId: "test-only-shipping", scene: "SHIPPING_TIME", matches: (texts) => texts.some((text) => text.includes("发货")) }],
  });
  const result = classifier.classify({
    turn: turn(),
    messages: [
      { messageId: "other-conversation-message", contentText: "什么时候发货" },
      { messageId: "m-1", contentText: "你好" },
    ],
  });
  assert.equal(result.scene, "OTHER_UNSUPPORTED", "text outside the turn must not decide the scene");
  assert.ok(result.diagnostics.includes("MESSAGES_OUTSIDE_TURN_IGNORED"));
});

test("the boundary is deterministic: identical input yields identical output and no mutation", () => {
  const classifier = createMinimalSceneClassifier({
    rules: [{ ruleId: "test-only-shipping", scene: "SHIPPING_TIME", matches: (texts) => texts.some((text) => text.includes("发货")) }],
  });
  const input = { turn: turn(), messages: [{ messageId: "m-1", contentText: "什么时候发货" }] };
  const before = JSON.stringify(input);
  const first = classifier.classify(input);
  const second = classifier.classify(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before, "the classifier never mutates its input");
  assert.equal(Object.isFrozen(first), true);
});

test("a registered first-scene rule routes SHIPPING_TIME while keeping automation ineligible", () => {
  const classifier = createMinimalSceneClassifier({
    rules: [{ ruleId: "test-only-shipping", scene: "SHIPPING_TIME", matches: (texts) => texts.some((text) => text.includes("发货")) }],
  });
  const result = classifier.classify({ turn: turn(), messages: [{ messageId: "m-1", contentText: "什么时候发货" }] });
  assert.equal(result.scene, "SHIPPING_TIME");
  assert.equal(result.ruleId, "test-only-shipping");
  assert.equal(result.reason, "APPROVED_RULE_MATCHED");
  assert.equal(result.newness, "NEWNESS_UNVERIFIED", "a classification does not upgrade newness");
  assert.equal(result.automaticProcessingEligible, false, "a classification never grants automation");
  assert.equal(classifier.diagnostics().byScene.SHIPPING_TIME, 1);
});

test("a rule claiming a scene outside the vocabulary is refused (second scene stays open)", () => {
  const classifier = createMinimalSceneClassifier({
    rules: [{ ruleId: "rogue-logistics", scene: "LOGISTICS", matches: () => true }],
  });
  const result = classifier.classify({ turn: turn(), messages: [{ messageId: "m-1", contentText: "快递到哪了" }] });
  assert.equal(result.scene, "OTHER_UNSUPPORTED", "an unapproved scene can never be produced");
  const diagnostics = classifier.diagnostics();
  assert.equal(diagnostics.registeredRules, 0);
  assert.equal(diagnostics.rejectedRules, 1);
  assert.ok(isMinimalScene(result.scene));
});

test("the classifier owns no send, AI or persistence port (structural boundary)", () => {
  const classifier = createMinimalSceneClassifier();
  assert.deepEqual(Object.keys(classifier).sort(), ["classify", "diagnostics"]);
  const result = classifier.classify({ turn: turn(), messages: [{ messageId: "m-1", contentText: "你好" }] });
  assert.deepEqual(Object.keys(result).sort(), [
    "automaticProcessingEligible", "contract", "decidedBy", "diagnostics", "identity_lock", "newness",
    "reason", "ruleId", "scene", "secondSceneDecision", "source_message_ids", "turn_id",
  ], "the classification carries no execution, reply or prompt field");
  const diagnostics = classifier.diagnostics();
  assert.equal(diagnostics.aiCalls, 0);
  assert.equal(diagnostics.sendCalls, 0);
  assert.equal(diagnostics.persistenceWrites, 0);
  assert.equal(diagnostics.sideEffectGuarantee, "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT");
});

test("handoff from the sealed SHEEP-303 turn builder: identity lock and turn identity carry through", () => {
  const clock = new VirtualClock();
  clock.set(1_800_000_000_000);
  const turns = [];
  const builder = createInboundTurnBuilder({
    enabled: true,
    clock,
    scheduler: { start() {}, stop() {} },
    onTurn: (produced) => turns.push(produced),
  });
  builder.ingest({
    receipt: { status: "INGESTED", conversationId: IDENTITY.conversationId, messageId: "m-1" },
    platform: "pdd",
    scope: { merchantId: "merchant-1", storeId: "store-1", platformAccountId: "account-1" },
    customerId: "2318082461",
    observedAt: "2026-09-22T00:00:00.000Z",
    actor: "customer",
    contentKind: "text",
    contentText: "什么时候发货",
  });
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  builder.poll();
  assert.equal(turns.length, 1, "the sealed builder produced one turn");
  builder.stop();

  const classifier = createMinimalSceneClassifier();
  const result = classifier.classify({ turn: turns[0], messages: [{ messageId: "m-1", contentText: "什么时候发货" }] });
  assert.equal(result.turn_id, turns[0].turn_id);
  assert.deepEqual(result.identity_lock, turns[0].identity_lock);
  assert.deepEqual([...result.source_message_ids], [...turns[0].source_message_ids]);
  assert.equal(result.newness, turns[0].newness);
  assert.equal(result.automaticProcessingEligible, turns[0].automaticProcessingEligible);
  assert.equal(result.scene, "OTHER_UNSUPPORTED", "no approved rule exists yet, so the safe path is taken");
});
