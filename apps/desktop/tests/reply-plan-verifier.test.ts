// SHEEP-306 P2-8d ReplyPlan Verifier - unit tests.
//
// Scope: Main verifier orchestration, sub-verifier aggregation, unknown handling.
// Deterministic: injectable clock, mock facts retrieval.
// No AI, no send, no persistence, no schema change is involved in this unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createReplyPlanVerifier,
  type ReplyPlanVerifierDeps,
} from "../dist/main/services/reply-plan-verifier.js";
import type { ReplyPlan, AuthoritativeFacts } from "@fastwork/domain";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createValidReplyPlan(overrides: Partial<ReplyPlan> = {}): ReplyPlan {
  return {
    plan_id: "plan-1",
    envelope_ref: "envelope-1",
    identity_lock: {
      merchant_id: "merchant-1",
      store_id: "store-1",
      platform: "pdd",
      platform_account_id: "account-1",
      customer_identity: { kind: "customerUid", value: "customer-123" },
      conversation_id: "conversation-1",
      trigger_message_id: "msg-1",
    },
    scene: "SHIPPING_TIME",
    trigger_message: {
      message_id: "msg-1",
      content: "什么时候发货？",
      received_at: "2026-09-29T10:00:00.000Z",
    },
    reply_content: {
      text: "我们会在48小时内发货。",
      language: "zh-CN",
    },
    verification_requirements: {
      identity_lock_valid: true,
      facts_validated: true,
    },
    created_at: "2026-09-29T10:00:00.000Z",
    ...overrides,
  };
}

function createValidFacts(): AuthoritativeFacts {
  return {
    shop_facts: {
      shipping_policy: {
        value: "48小时内发货",
        source: "merchant_config",
      },
    },
  };
}

function createMockDeps(facts?: AuthoritativeFacts): ReplyPlanVerifierDeps {
  return {
    getFactsForEnvelope: async (_envelopeRef: string) => facts ?? createValidFacts(),
  };
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

test("ReplyPlanVerifier: valid plan passes all verifications", async () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.shipping_policy",
        source: "merchant_config",
      },
    ],
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, true);
  assert.equal(result.plan_id, "plan-1");
  assert.equal(result.errors.length, 0);
  assert.ok(result.verified_at);
});

test("ReplyPlanVerifier: plan with no fact_references passes", async () => {
  const plan = createValidReplyPlan({ fact_references: undefined });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("ReplyPlanVerifier: invalid identity_lock produces errors", async () => {
  const plan = createValidReplyPlan({
    identity_lock: {
      merchant_id: "",
      store_id: "store-1",
      platform: "pdd",
      platform_account_id: "account-1",
      customer_identity: { kind: "customerUid", value: "customer-123" },
      conversation_id: "conversation-1",
      trigger_message_id: "msg-1",
    },
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.category === "identity_lock"));
});

test("ReplyPlanVerifier: missing fact produces error", async () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-missing",
        fact_key: "shop_facts.nonexistent",
        source: "merchant_config",
      },
    ],
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.category === "fact_freshness"));
});

test("ReplyPlanVerifier: blocking unknown produces error", async () => {
  const plan = createValidReplyPlan({
    unknowns: [
      {
        unknown_id: "unknown-1",
        category: "missing_identity",
        description: "Customer identity could not be resolved",
        blocking: true,
      },
    ],
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.category === "unknown_blocking"));
  assert.ok(result.errors.some((e) => e.error_id === "blocking_unknowns_detected"));
});

test("ReplyPlanVerifier: non-blocking unknown produces warning", async () => {
  const plan = createValidReplyPlan({
    unknowns: [
      {
        unknown_id: "unknown-1",
        category: "stale_evidence",
        description: "Fact retrieved 5 minutes ago",
        blocking: false,
      },
    ],
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].severity, "warning");
  assert.equal(result.warnings[0].blocking, false);
});

test("ReplyPlanVerifier: mix of blocking and non-blocking unknowns", async () => {
  const plan = createValidReplyPlan({
    unknowns: [
      {
        unknown_id: "unknown-blocking",
        category: "missing_fact",
        description: "Required fact not available",
        blocking: true,
      },
      {
        unknown_id: "unknown-warning",
        category: "low_confidence_inference",
        description: "Low confidence intent classification",
        blocking: false,
      },
    ],
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.category === "unknown_blocking" && e.blocking));
  assert.ok(result.warnings.some((w) => w.category === "unknown_blocking" && !w.blocking));
});

test("ReplyPlanVerifier: multiple errors from different categories", async () => {
  const plan = createValidReplyPlan({
    identity_lock: {
      merchant_id: "",
      store_id: "store-1",
      platform: "pdd",
      platform_account_id: "account-1",
      customer_identity: { kind: "customerUid", value: "customer-123" },
      conversation_id: "conversation-1",
      trigger_message_id: "msg-1",
    },
    fact_references: [
      {
        fact_id: "fact-missing",
        fact_key: "shop_facts.nonexistent",
        source: "merchant_config",
      },
    ],
    unknowns: [
      {
        unknown_id: "unknown-1",
        category: "missing_identity",
        description: "Identity unresolved",
        blocking: true,
      },
    ],
  });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.category === "identity_lock"));
  assert.ok(result.errors.some((e) => e.category === "fact_freshness"));
  assert.ok(result.errors.some((e) => e.category === "unknown_blocking"));
});

test("ReplyPlanVerifier: verified_at is ISO 8601", async () => {
  const plan = createValidReplyPlan();
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.ok(result.verified_at);
  // Verify ISO 8601 format
  const date = new Date(result.verified_at);
  assert.ok(!isNaN(date.getTime()), "verified_at should be valid ISO 8601");
});

test("ReplyPlanVerifier: getFactsForEnvelope is called with correct envelope_ref", async () => {
  let capturedRef: string | undefined;
  const deps: ReplyPlanVerifierDeps = {
    getFactsForEnvelope: async (envelopeRef: string) => {
      capturedRef = envelopeRef;
      return createValidFacts();
    },
  };
  const plan = createValidReplyPlan({ envelope_ref: "test-envelope-ref" });
  const verifier = createReplyPlanVerifier(deps);

  await verifier.verify(plan);

  assert.equal(capturedRef, "test-envelope-ref");
});

test("ReplyPlanVerifier: getFactsForEnvelope returning undefined causes fact errors", async () => {
  const deps: ReplyPlanVerifierDeps = {
    getFactsForEnvelope: async () => undefined,
  };
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.shipping_policy",
        source: "merchant_config",
      },
    ],
  });
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.category === "fact_freshness"));
});

test("ReplyPlanVerifier: empty unknowns array produces no errors or warnings", async () => {
  const plan = createValidReplyPlan({ unknowns: [] });
  const deps = createMockDeps();
  const verifier = createReplyPlanVerifier(deps);

  const result = await verifier.verify(plan);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});
