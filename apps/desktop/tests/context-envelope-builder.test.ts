// SHEEP-306 P2-13 ContextEnvelope Builder - unit tests.
//
// Scope: Builder orchestration logic, sub-component integration, and error handling.
// Deterministic time: all timestamps use injectable Clock.
// No AI, no send, no persistence, no schema change is involved in this unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createContextEnvelopeBuilder,
  type ContextEnvelopeBuilderDeps,
  type ContextEnvelopeBuildInput,
} from "../dist/main/services/context-envelope-builder.js";
import type { InboundTurn } from "../dist/main/services/inbound-turn-builder.js";
import type { SceneMessageFact } from "../dist/main/services/minimal-scene-classifier.js";
import type { AuthoritativeFactsPort } from "../dist/main/ports/authoritative-facts-port.js";
import type { StoreKnowledgeRetrievalPort, StoreKnowledgeQueryResult } from "../dist/main/ports/store-knowledge-retrieval-port.js";
import type { MinimalSceneClassifier, SceneClassification } from "../dist/main/services/minimal-scene-classifier.js";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createMockInboundTurn(overrides: Partial<InboundTurn> = {}): InboundTurn {
  return {
    turn_id: "turn-1",
    identity_lock: {
      platform: "pdd",
      merchantId: "merchant-1",
      storeId: "store-1",
      platformAccountId: "account-1",
      conversationId: "conversation-1",
      customerId: "customer-1",
    },
    source_message_ids: ["msg-1"],
    source_observed_at: ["2026-09-29T10:00:00.000Z"],
    created_at: "2026-09-29T10:00:00.000Z",
    newness: "NEWNESS_UNVERIFIED",
    automaticProcessingEligible: false,
    ...overrides,
  };
}

function createMockSceneMessageFacts(): SceneMessageFact[] {
  return [
    {
      message_id: "msg-1",
      text: "什么时候发货？",
      is_customer_message: true,
    },
  ];
}

function createMockSceneClassification(overrides: Partial<SceneClassification> = {}): SceneClassification {
  return {
    contract: "MINIMAL_V1",
    scene: "SHIPPING_TIME",
    turn_id: "turn-1",
    identity_lock: {
      platform: "pdd",
      merchantId: "merchant-1",
      storeId: "store-1",
      platformAccountId: "account-1",
      conversationId: "conversation-1",
      customerId: "customer-1",
    },
    reason: "KEYWORD_MATCH",
    ruleId: "rule-1",
    automaticProcessingEligible: true,
    diagnostics: [],
    ...overrides,
  };
}

function createMockSceneClassifier(classification?: SceneClassification): MinimalSceneClassifier {
  return {
    classify: () => classification ?? createMockSceneClassification(),
  };
}

function createMockFactsPort(facts?: any): AuthoritativeFactsPort {
  return {
    gather: async () => facts ?? {
      shop_facts: {},
      product_facts: {},
      knowledge_facts: {},
    },
  };
}

function createMockKnowledgePort(result?: StoreKnowledgeQueryResult): StoreKnowledgeRetrievalPort {
  return {
    query: async () => result ?? { ok: true, entries: [], count: 0 },
    list: async () => ({ ok: true, entries: [], count: 0 }),
  };
}

function createMockClock(now: string = "2026-09-29T10:00:00.000Z") {
  return { now: () => now };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("ContextEnvelopeBuilder - builds complete envelope with all components", async () => {
  const turn = createMockInboundTurn();
  const messageFacts = createMockSceneMessageFacts();
  const classification = createMockSceneClassification({ scene: "SHIPPING_TIME" });

  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(classification),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort(),
    clock: createMockClock(),
  };

  const builder = createContextEnvelopeBuilder(deps);
  const input: ContextEnvelopeBuildInput = { turn, messageFacts };

  const envelope = await builder.build(input);

  // Verify envelope structure
  assert.ok(envelope.envelope_id, "envelope_id should be generated");
  assert.equal(envelope.conversation_id, "conversation-1");
  assert.equal(envelope.scene, "SHIPPING_TIME");
  assert.equal(envelope.trigger_message.message_id, "msg-1");
  assert.ok(envelope.identity_lock);
  assert.equal(envelope.identity_lock.merchant_id, "merchant-1");
  assert.equal(envelope.identity_lock.store_id, "store-1");
  assert.equal(envelope.identity_lock.platform, "pdd");
  assert.equal(envelope.created_at, "2026-09-29T10:00:00.000Z");
});

test("ContextEnvelopeBuilder - maps InboundTurn identity_lock to ContractIdentityLock", async () => {
  const turn = createMockInboundTurn({
    identity_lock: {
      platform: "doudian",
      merchantId: "merchant-2",
      storeId: "store-2",
      platformAccountId: "account-2",
      conversationId: "conversation-2",
      customerId: "customer-2",
    },
  });

  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort(),
    clock: createMockClock(),
  };

  const builder = createContextEnvelopeBuilder(deps);
  const envelope = await builder.build({ turn, messageFacts: [] });

  // Verify identity lock mapping (camelCase → snake_case)
  assert.equal(envelope.identity_lock.merchant_id, "merchant-2");
  assert.equal(envelope.identity_lock.store_id, "store-2");
  assert.equal(envelope.identity_lock.platform, "doudian");
  assert.equal(envelope.identity_lock.platform_account_id, "account-2");
  assert.equal(envelope.identity_lock.conversation_id, "conversation-2");
  assert.equal(envelope.identity_lock.customer_identity.kind, "customerUid");
  assert.equal(envelope.identity_lock.customer_identity.value, "customer-2");
});

test("ContextEnvelopeBuilder - includes retrieved_knowledge when available", async () => {
  const knowledgeResult: StoreKnowledgeQueryResult = {
    ok: true,
    entries: [
      {
        id: "knowledge-1",
        merchant_id: "merchant-1",
        store_id: "store-1",
        knowledge_type: "SHIPPING_TIME",
        title: "发货时间规则",
        content: "48小时内发货",
        tags: ["发货", "时间"],
        source: "OWNER_INPUT",
        status: "ACTIVE",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
      },
    ],
    count: 1,
  };

  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort(knowledgeResult),
    clock: createMockClock(),
  };

  const builder = createContextEnvelopeBuilder(deps);
  const envelope = await builder.build({
    turn: createMockInboundTurn(),
    messageFacts: createMockSceneMessageFacts(),
  });

  // Verify knowledge is included
  assert.ok(envelope.retrieved_knowledge, "retrieved_knowledge should be present");
  assert.equal(envelope.retrieved_knowledge?.length, 1);
  assert.equal(envelope.retrieved_knowledge?.[0].knowledge_id, "knowledge-1");
  assert.equal(envelope.retrieved_knowledge?.[0].knowledge_type, "STORE_RULE");
  assert.equal(envelope.retrieved_knowledge?.[0].store_knowledge_type, "SHIPPING_TIME");
});

test("ContextEnvelopeBuilder - handles empty knowledge result", async () => {
  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort({ ok: true, entries: [], count: 0 }),
    clock: createMockClock(),
  };

  const builder = createContextEnvelopeBuilder(deps);
  const envelope = await builder.build({
    turn: createMockInboundTurn(),
    messageFacts: createMockSceneMessageFacts(),
  });

  // Verify no knowledge when result is empty
  assert.equal(envelope.retrieved_knowledge, undefined);
});

test("ContextEnvelopeBuilder - handles knowledge query failure", async () => {
  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort({ ok: false, entries: [], count: 0, error: "Query failed" }),
    clock: createMockClock(),
  };

  const builder = createContextEnvelopeBuilder(deps);
  const envelope = await builder.build({
    turn: createMockInboundTurn(),
    messageFacts: createMockSceneMessageFacts(),
  });

  // Verify no knowledge when query fails
  assert.equal(envelope.retrieved_knowledge, undefined);
});

test("ContextEnvelopeBuilder - uses default SystemClock when not provided", async () => {
  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort(),
    // clock not provided
  };

  const builder = createContextEnvelopeBuilder(deps);
  const envelope = await builder.build({
    turn: createMockInboundTurn(),
    messageFacts: createMockSceneMessageFacts(),
  });

  // Verify created_at is a valid ISO timestamp
  assert.ok(envelope.created_at, "created_at should be present");
  assert.ok(!isNaN(Date.parse(envelope.created_at)), "created_at should be valid ISO timestamp");
});

test("ContextEnvelopeBuilder - propagates scene classification correctly", async () => {
  const classification = createMockSceneClassification({ scene: "UNKNOWN" });

  const deps: ContextEnvelopeBuilderDeps = {
    sceneClassifier: createMockSceneClassifier(classification),
    factsPort: createMockFactsPort(),
    knowledgePort: createMockKnowledgePort(),
    clock: createMockClock(),
  };

  const builder = createContextEnvelopeBuilder(deps);
  const envelope = await builder.build({
    turn: createMockInboundTurn(),
    messageFacts: createMockSceneMessageFacts(),
  });

  // Verify scene is adapted correctly
  assert.equal(envelope.scene, "UNKNOWN");
});
