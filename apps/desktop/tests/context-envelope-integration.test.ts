// SHEEP-306 P2-13 ContextEnvelope Integration - unit tests.
//
// Scope: Shadow mode integration for Builder and Verifier.
// Tests fire-and-forget behavior, event emission, error handling.
// No AI, no send, no persistence, no schema change is involved in this unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createContextEnvelopeIntegration,
  type ContextEnvelopeIntegrationOptions,
} from "../dist/main/services/context-envelope-integration.js";
import {
  createReplyPlanVerificationIntegration,
  type ReplyPlanVerificationIntegrationOptions,
} from "../dist/main/services/reply-plan-verification-integration.js";
import type { ContextEnvelopeBuilder, ContextEnvelopeBuildInput } from "../dist/main/services/context-envelope-builder.js";
import type { InboundTurn } from "../dist/main/services/inbound-turn-builder.js";
import type { SceneMessageFact } from "../dist/main/services/minimal-scene-classifier.js";
import type { ReplyPlanVerifierPort, VerificationResult } from "../dist/main/ports/reply-plan-verifier-port.js";
import type { ContextEnvelope } from "@fastwork/domain";

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

function createMockEnvelope(overrides: Partial<ContextEnvelope> = {}): ContextEnvelope {
  return {
    envelope_id: "envelope-1",
    conversation_id: "conversation-1",
    identity_lock: {
      merchant_id: "merchant-1",
      store_id: "store-1",
      platform: "pdd",
      platform_account_id: "account-1",
      customer_identity: { kind: "customerUid", value: "customer-1" },
      conversation_id: "conversation-1",
      trigger_message_id: "msg-1",
    },
    scene: "SHIPPING_TIME",
    trigger_message: {
      message_id: "msg-1",
      content: "什么时候发货？",
      received_at: "2026-09-29T10:00:00.000Z",
    },
    authoritative_facts: {
      shop_facts: {
        shipping_policy: { value: "48小时内发货", source: "merchant_config" },
      },
    },
    retrieved_knowledge: [],
    explicit_unknowns: [],
    created_at: "2026-09-29T10:00:00.000Z",
    ...overrides,
  };
}

function createMockBuilder(envelope?: ContextEnvelope): ContextEnvelopeBuilder {
  return {
    build: async (_input: ContextEnvelopeBuildInput) =>
      envelope ?? createMockEnvelope(),
  };
}

function createMockVerifier(result?: VerificationResult): ReplyPlanVerifierPort {
  return {
    verify: async (_plan: any) =>
      result ?? {
        ok: true,
        plan_id: "plan-1",
        errors: [],
        warnings: [],
        verified_at: new Date().toISOString(),
      },
  };
}

function createMockInput(): ContextEnvelopeBuildInput {
  return {
    turn: createMockInboundTurn(),
    messageFacts: createMockSceneMessageFacts(),
    productId: undefined,
  };
}

// ─── ContextEnvelopeIntegration Tests ────────────────────────────────────────

test("ContextEnvelopeIntegration: isEnabled returns false when no builder", () => {
  const integration = createContextEnvelopeIntegration({});
  assert.equal(integration.isEnabled(), false);
});

test("ContextEnvelopeIntegration: isEnabled returns true when builder provided", () => {
  const integration = createContextEnvelopeIntegration({
    builder: createMockBuilder(),
  });
  assert.equal(integration.isEnabled(), true);
});

test("ContextEnvelopeIntegration: runShadowMode does nothing when no builder", async () => {
  let eventEmitted = false;
  const integration = createContextEnvelopeIntegration({
    eventSink: () => { eventEmitted = true; },
  });

  integration.runShadowMode(createMockInput());

  // Wait a tick for any async operations
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(eventEmitted, false);
});

test("ContextEnvelopeIntegration: runShadowMode emits ContextEnvelopeBuilt on success", async () => {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const integration = createContextEnvelopeIntegration({
    builder: createMockBuilder(),
    eventSink: (event, payload) => events.push({ event, payload }),
  });

  integration.runShadowMode(createMockInput());

  // Wait for async build to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "ContextEnvelopeBuilt");
  assert.equal(events[0].payload.envelope_id, "envelope-1");
  assert.equal(events[0].payload.conversation_id, "conversation-1");
  assert.equal(events[0].payload.scene, "SHIPPING_TIME");
});

test("ContextEnvelopeIntegration: runShadowMode emits ContextEnvelopeBuildFailed on error", async () => {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const errors: Array<{ error: unknown; context: string }> = [];
  const failingBuilder: ContextEnvelopeBuilder = {
    build: async () => { throw new Error("Build failed"); },
  };

  const integration = createContextEnvelopeIntegration({
    builder: failingBuilder,
    eventSink: (event, payload) => events.push({ event, payload }),
    errorLogger: (error, context) => errors.push({ error, context }),
  });

  integration.runShadowMode(createMockInput());

  // Wait for async build to fail
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "ContextEnvelopeBuildFailed");
  assert.equal(events[0].payload.error, "Build failed");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].context, "shadow_mode_build");
});

test("ContextEnvelopeIntegration: runShadowMode never throws", () => {
  const failingBuilder: ContextEnvelopeBuilder = {
    build: async () => { throw new Error("Build failed"); },
  };

  const integration = createContextEnvelopeIntegration({
    builder: failingBuilder,
  });

  // Should not throw
  assert.doesNotThrow(() => {
    integration.runShadowMode(createMockInput());
  });
});

// ─── ReplyPlanVerificationIntegration Tests ──────────────────────────────────

test("ReplyPlanVerificationIntegration: isEnabled returns false when no builder", () => {
  const integration = createReplyPlanVerificationIntegration({});
  assert.equal(integration.isEnabled(), false);
});

test("ReplyPlanVerificationIntegration: isEnabled returns false when no verifier", () => {
  const integration = createReplyPlanVerificationIntegration({
    builder: createMockBuilder(),
  });
  assert.equal(integration.isEnabled(), false);
});

test("ReplyPlanVerificationIntegration: isEnabled returns true when both provided", () => {
  const integration = createReplyPlanVerificationIntegration({
    builder: createMockBuilder(),
    verifier: createMockVerifier(),
  });
  assert.equal(integration.isEnabled(), true);
});

test("ReplyPlanVerificationIntegration: runShadowMode does nothing when disabled", async () => {
  let eventEmitted = false;
  const integration = createReplyPlanVerificationIntegration({
    eventSink: () => { eventEmitted = true; },
  });

  integration.runShadowMode(createMockInput());

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(eventEmitted, false);
});

test("ReplyPlanVerificationIntegration: emits ContextEnvelopeBuilt and ReplyPlanVerified on success", async () => {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const integration = createReplyPlanVerificationIntegration({
    builder: createMockBuilder(),
    verifier: createMockVerifier(),
    eventSink: (event, payload) => events.push({ event, payload }),
  });

  integration.runShadowMode(createMockInput());

  // Wait for async build+verify to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 2);
  assert.equal(events[0].event, "ContextEnvelopeBuilt");
  assert.equal(events[0].payload.envelope_id, "envelope-1");
  assert.equal(events[1].event, "ReplyPlanVerified");
  assert.equal(events[1].payload.envelope_ref, "envelope-1");
});

test("ReplyPlanVerificationIntegration: emits ReplyPlanVerificationFailed on verify failure", async () => {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const failingVerifier = createMockVerifier({
    ok: false,
    plan_id: "plan-1",
    errors: [
      {
        error_id: "test_error",
        category: "identity_lock",
        severity: "error",
        message: "Test error",
        blocking: true,
      },
    ],
    warnings: [],
    verified_at: new Date().toISOString(),
  });

  const integration = createReplyPlanVerificationIntegration({
    builder: createMockBuilder(),
    verifier: failingVerifier,
    eventSink: (event, payload) => events.push({ event, payload }),
  });

  integration.runShadowMode(createMockInput());

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 2);
  assert.equal(events[0].event, "ContextEnvelopeBuilt");
  assert.equal(events[1].event, "ReplyPlanVerificationFailed");
  assert.equal(events[1].payload.error_count, 1);
});

test("ReplyPlanVerificationIntegration: emits ReplyPlanBuildOrVerifyFailed on builder error", async () => {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const errors: Array<{ error: unknown; context: string }> = [];
  const failingBuilder: ContextEnvelopeBuilder = {
    build: async () => { throw new Error("Builder crashed"); },
  };

  const integration = createReplyPlanVerificationIntegration({
    builder: failingBuilder,
    verifier: createMockVerifier(),
    eventSink: (event, payload) => events.push({ event, payload }),
    errorLogger: (error, context) => errors.push({ error, context }),
  });

  integration.runShadowMode(createMockInput());

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "ReplyPlanBuildOrVerifyFailed");
  assert.equal(events[0].payload.error, "Builder crashed");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].context, "shadow_mode_build_and_verify");
});

test("ReplyPlanVerificationIntegration: runShadowMode never throws", () => {
  const failingBuilder: ContextEnvelopeBuilder = {
    build: async () => { throw new Error("Build failed"); },
  };

  const integration = createReplyPlanVerificationIntegration({
    builder: failingBuilder,
    verifier: createMockVerifier(),
  });

  assert.doesNotThrow(() => {
    integration.runShadowMode(createMockInput());
  });
});

test("ReplyPlanVerificationIntegration: blocking unknowns in envelope produce verification failure", async () => {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const envelopeWithBlockingUnknowns = createMockEnvelope({
    explicit_unknowns: [
      {
        unknown_id: "unknown-1",
        description: "Missing identity",
        blocking: true,
      },
    ],
  });

  // Verifier that fails when there are blocking unknowns
  const verifier: ReplyPlanVerifierPort = {
    verify: async (plan: any) => {
      const hasBlocking = plan.unknowns?.some((u: any) => u.blocking) ?? false;
      return {
        ok: !hasBlocking,
        plan_id: plan.plan_id,
        errors: hasBlocking
          ? [{ error_id: "blocking_unknown", category: "unknown_blocking", severity: "error", message: "Blocking unknown", blocking: true }]
          : [],
        warnings: [],
        verified_at: new Date().toISOString(),
      };
    },
  };

  const integration = createReplyPlanVerificationIntegration({
    builder: createMockBuilder(envelopeWithBlockingUnknowns),
    verifier,
    eventSink: (event, payload) => events.push({ event, payload }),
  });

  integration.runShadowMode(createMockInput());

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 2);
  assert.equal(events[1].event, "ReplyPlanVerificationFailed");
});
