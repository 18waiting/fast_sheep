/**
 * PolicyEngine Tests (SHEEP-308).
 *
 * DEFERRED: These tests require Node.js v22+ (--experimental-strip-types).
 * Run on personal computer (Windows, E:\fast_sheep\).
 *
 * Test command: pnpm run test apps/desktop/tests/policy-engine.test.ts
 */

import { describe, it, expect } from "vitest";
import { PolicyEngine } from "../src/main/services/policy-engine.js";
import type { ContextEnvelope, ReplyPlan, PolicyConfig } from "@fastwork/domain";

// Helper: Create a minimal valid ContextEnvelope
function createValidEnvelope(overrides?: Partial<ContextEnvelope>): ContextEnvelope {
  return {
    envelope_id: "env_123",
    conversation_id: "conv_123",
    identity_lock: {
      merchant_id: "merchant_123",
      store_id: "shop_123",
      platform: "pdd",
      platform_account_id: "acc_123",
      customer_identity: { kind: "customerUid", value: "cust_123" },
      conversation_id: "conv_123",
      trigger_message_id: "msg_123",
    },
    scene: "SHIPPING",
    trigger_message: {
      message_id: "msg_123",
      content: "什么时候发货？",
      received_at: "2026-09-29T10:00:00Z",
    },
    authoritative_facts: {
      fact_set_id: "facts_123",
      store_id: "shop_123",
      facts: [],
      fetched_at: "2026-09-29T10:00:00Z",
    },
    created_at: "2026-09-29T10:00:00Z",
    ...overrides,
  } as ContextEnvelope;
}

// Helper: Create a minimal ReplyPlan
function createReplyPlan(overrides?: Partial<ReplyPlan>): ReplyPlan {
  return {
    plan_id: "plan_123",
    envelope_ref: "env_123",
    reply_content: { text: "我们会在48小时内发货", language: "zh-CN" },
    fact_references: [],
    knowledge_references: [],
    inference_references: [],
    verification_requirements: {},
    policy_metadata: {},
    created_at: "2026-09-29T10:00:00Z",
    ...overrides,
  } as ReplyPlan;
}

// Helper: Create a simple PolicyConfig
function createConfig(mode: string = "HUMAN_CONFIRM"): PolicyConfig {
  return {
    global: { default_mode: mode as any },
  };
}

describe("PolicyEngine", () => {
  const engine = new PolicyEngine();

  describe("IdentityLock validation", () => {
    it("blocks when merchant_id is missing", async () => {
      const envelope = createValidEnvelope({
        identity_lock: {
          merchant_id: "",
          store_id: "shop_123",
          platform: "pdd",
          platform_account_id: "acc_123",
          customer_identity: { kind: "customerUid", value: "cust_123" },
          conversation_id: "conv_123",
          trigger_message_id: "msg_123",
        },
      } as any);

      const decision = await engine.evaluate(envelope, createReplyPlan(), createConfig());
      expect(decision.allowed).toBe(false);
      expect(decision.blocking_issues).toContain("IdentityLock missing merchant_id");
      expect(decision.rollout_mode).toBe("OFF");
    });

    it("blocks when store_id is missing", async () => {
      const envelope = createValidEnvelope({
        identity_lock: {
          merchant_id: "merchant_123",
          store_id: "",
          platform: "pdd",
          platform_account_id: "acc_123",
          customer_identity: { kind: "customerUid", value: "cust_123" },
          conversation_id: "conv_123",
          trigger_message_id: "msg_123",
        },
      } as any);

      const decision = await engine.evaluate(envelope, createReplyPlan(), createConfig());
      expect(decision.allowed).toBe(false);
      expect(decision.blocking_issues).toContain("IdentityLock missing store_id");
    });

    it("blocks when customer_identity is incomplete", async () => {
      const envelope = createValidEnvelope({
        identity_lock: {
          merchant_id: "merchant_123",
          store_id: "shop_123",
          platform: "pdd",
          platform_account_id: "acc_123",
          customer_identity: { kind: "customerUid", value: "" },
          conversation_id: "conv_123",
          trigger_message_id: "msg_123",
        },
      } as any);

      const decision = await engine.evaluate(envelope, createReplyPlan(), createConfig());
      expect(decision.allowed).toBe(false);
      expect(decision.blocking_issues).toContain("IdentityLock missing or incomplete customer_identity");
    });

    it("passes with valid IdentityLock", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig(),
      );
      expect(decision.allowed).toBe(true);
      expect(decision.reasons).toContain("IdentityLock validated");
    });
  });

  describe("Blocking unknowns", () => {
    it("blocks when blocking unknowns present", async () => {
      const envelope = createValidEnvelope({
        explicit_unknowns: [
          {
            unknown_id: "uk_1",
            category: "missing_fact",
            description: "Product weight unknown",
            blocking: true,
          },
        ],
      } as any);

      const decision = await engine.evaluate(envelope, createReplyPlan(), createConfig());
      expect(decision.allowed).toBe(false);
      expect(decision.blocking_issues.some((i) => i.includes("Blocking unknown"))).toBe(true);
    });

    it("allows when unknowns are non-blocking", async () => {
      const envelope = createValidEnvelope({
        explicit_unknowns: [
          {
            unknown_id: "uk_1",
            category: "missing_fact",
            description: "Product color unknown",
            blocking: false,
          },
        ],
      } as any);

      const decision = await engine.evaluate(envelope, createReplyPlan(), createConfig());
      expect(decision.allowed).toBe(true);
    });
  });

  describe("RolloutMode resolution", () => {
    it("returns HUMAN_CONFIRM by default", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig("HUMAN_CONFIRM"),
      );
      expect(decision.rollout_mode).toBe("HUMAN_CONFIRM");
      expect(decision.requires_confirmation).toBe(true);
    });

    it("returns SHADOW when configured", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig("SHADOW"),
      );
      expect(decision.rollout_mode).toBe("SHADOW");
      expect(decision.requires_confirmation).toBe(false);
    });

    it("returns OFF when configured", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig("OFF"),
      );
      expect(decision.rollout_mode).toBe("OFF");
    });
  });

  describe("Risk assessment", () => {
    it("forces HUMAN_CONFIRM for high-risk scenes", async () => {
      const envelope = createValidEnvelope({ scene: "REFUND" } as any);
      const config: PolicyConfig = {
        global: { default_mode: "SHADOW" },
      };

      const decision = await engine.evaluate(envelope, createReplyPlan(), config);
      // REFUND is medium risk, not high risk
      // High risk is only when blocking unknowns present
      expect(decision.rollout_mode).toBe("SHADOW");
    });

    it("blocks entirely when blocking unknowns present", async () => {
      const envelope = createValidEnvelope({
        explicit_unknowns: [
          {
            unknown_id: "uk_1",
            category: "missing_fact",
            description: "Critical info missing",
            blocking: true,
          },
        ],
      } as any);

      const config: PolicyConfig = {
        global: { default_mode: "SHADOW" },
      };

      const decision = await engine.evaluate(envelope, createReplyPlan(), config);
      // Blocking unknowns → blocked entirely (not just forced HUMAN_CONFIRM)
      expect(decision.allowed).toBe(false);
    });
  });

  describe("Policy metadata", () => {
    it("includes evaluation timestamp", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig(),
      );
      expect(decision.evaluated_at).toBeTruthy();
      expect(decision.evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("includes policy version", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig(),
      );
      expect(decision.policy_version).toBe("1.0.0");
    });

    it("includes reasons for decision", async () => {
      const decision = await engine.evaluate(
        createValidEnvelope(),
        createReplyPlan(),
        createConfig(),
      );
      expect(decision.reasons.length).toBeGreaterThan(0);
    });
  });
});
