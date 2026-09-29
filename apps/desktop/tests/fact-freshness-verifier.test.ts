// SHEEP-306 P2-8c Fact Freshness Verifier - unit tests.
//
// Scope: Fact reference existence and source validation.
// Deterministic: pure function, no side effects, no time dependency.
// No AI, no send, no persistence, no schema change is involved in this unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyFactFreshness } from "../dist/main/services/fact-freshness-verifier.js";
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
    product_facts: {
      weight: {
        value: "0.5kg",
        source: "platform_api",
      },
    },
  };
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

test("verifyFactFreshness: no fact_references passes", () => {
  const plan = createValidReplyPlan({ fact_references: undefined });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("verifyFactFreshness: empty fact_references passes", () => {
  const plan = createValidReplyPlan({ fact_references: [] });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("verifyFactFreshness: valid fact reference passes", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.shipping_policy",
        source: "merchant_config",
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("verifyFactFreshness: missing fact fails", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.nonexistent_key",
        source: "merchant_config",
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "fact_missing_fact-1");
  assert.equal(result.errors[0].category, "fact_freshness");
  assert.equal(result.errors[0].blocking, true);
});

test("verifyFactFreshness: fact with invalid source fails", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.shipping_policy",
        source: "invalid_source" as any,
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "fact_invalid_source_fact-1");
  assert.match(result.errors[0].message, /invalid_source/);
});

test("verifyFactFreshness: valid fact sources pass", () => {
  const validSources: Array<"platform_api" | "merchant_config" | "store_knowledge" | "product_knowledge" | "order_system" | "logistics_system"> = [
    "platform_api",
    "merchant_config",
    "store_knowledge",
    "product_knowledge",
    "order_system",
    "logistics_system",
  ];

  for (const source of validSources) {
    const plan = createValidReplyPlan({
      fact_references: [
        {
          fact_id: `fact-${source}`,
          fact_key: "shop_facts.shipping_policy",
          source,
        },
      ],
    });
    const facts = createValidFacts();
    const result = verifyFactFreshness(plan, facts);
    assert.equal(result.ok, true, `Source ${source} should be valid`);
  }
});

test("verifyFactFreshness: invalid fact_key format fails", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "invalid_format_no_dot",
        source: "merchant_config",
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "fact_invalid_key_format_fact-1");
});

test("verifyFactFreshness: invalid fact category fails", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "invalid_category.some_key",
        source: "merchant_config",
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "fact_invalid_key_format_fact-1");
});

test("verifyFactFreshness: fact_references but no authoritative_facts fails", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.shipping_policy",
        source: "merchant_config",
      },
    ],
  });
  const result = verifyFactFreshness(plan, undefined);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "fact_missing_fact-1");
  assert.match(result.errors[0].message, /authoritative_facts is empty/);
});

test("verifyFactFreshness: multiple missing facts produce multiple errors", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "shop_facts.missing_1",
        source: "merchant_config",
      },
      {
        fact_id: "fact-2",
        fact_key: "product_facts.missing_2",
        source: "platform_api",
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.some((e) => e.error_id === "fact_missing_fact-1"));
  assert.ok(result.errors.some((e) => e.error_id === "fact_missing_fact-2"));
});

test("verifyFactFreshness: mix of valid and invalid facts", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-valid",
        fact_key: "shop_facts.shipping_policy",
        source: "merchant_config",
      },
      {
        fact_id: "fact-missing",
        fact_key: "shop_facts.nonexistent",
        source: "merchant_config",
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "fact_missing_fact-missing");
});

test("verifyFactFreshness: all errors are blocking", () => {
  const plan = createValidReplyPlan({
    fact_references: [
      {
        fact_id: "fact-1",
        fact_key: "invalid_format",
        source: "invalid_source" as any,
      },
    ],
  });
  const facts = createValidFacts();
  const result = verifyFactFreshness(plan, facts);

  assert.equal(result.ok, false);
  for (const error of result.errors) {
    assert.equal(error.blocking, true);
    assert.equal(error.severity, "error");
  }
});

test("verifyFactFreshness: valid fact categories", () => {
  const validCategories = [
    "shop_facts",
    "product_facts",
    "order_facts",
    "logistics_facts",
    "knowledge_facts",
  ];

  const facts: AuthoritativeFacts = {
    shop_facts: { key1: { value: "v1", source: "s1" } },
    product_facts: { key2: { value: "v2", source: "s2" } },
    order_facts: { key3: { value: "v3", source: "s3" } },
    logistics_facts: { key4: { value: "v4", source: "s4" } },
    knowledge_facts: { key5: { value: "v5", source: "s5" } },
  };

  for (const category of validCategories) {
    const keyMap: Record<string, string> = {
      shop_facts: "key1",
      product_facts: "key2",
      order_facts: "key3",
      logistics_facts: "key4",
      knowledge_facts: "key5",
    };
    const plan = createValidReplyPlan({
      fact_references: [
        {
          fact_id: `fact-${category}`,
          fact_key: `${category}.${keyMap[category]}`,
          source: "merchant_config",
        },
      ],
    });
    const result = verifyFactFreshness(plan, facts);
    assert.equal(result.ok, true, `Category ${category} should be valid`);
  }
});
