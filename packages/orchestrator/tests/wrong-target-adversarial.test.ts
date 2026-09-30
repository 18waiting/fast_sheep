// SHEEP-310: Adversarial Wrong-Target Tests
// 对抗性测试：验证所有组件在错误目标场景下的行为
import { test } from "node:test";
import assert from "node:assert/strict";
import { SendFailureClassifier } from "../src/core/send-failure-classifier.ts";
import { WrongTargetValidator } from "../src/core/wrong-target-validator.ts";
import { BindingValidator } from "../src/core/binding-validator.ts";
import { RetryPolicy } from "../src/policies/retry-policy.ts";
import type { SendAttempt } from "../src/ports/platform-adapter.ts";

// ============================================================================
// 场景 1：跨店铺执行
// ============================================================================
test("对抗性：跨店铺执行被拒绝", () => {
  const validator = new WrongTargetValidator();
  const result = validator.validate({
    shopId: "shop-B",
    conversationId: "conv-1",
    expectedShopId: "shop-A",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "shopId" && f.reason.includes("cross-shop")));
});

// ============================================================================
// 场景 2：过期选择（stale selection）
// ============================================================================
test("对抗性：过期 triggerMessageId 被拒绝", () => {
  const validator = new WrongTargetValidator();
  const result = validator.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    triggerMessageId: "",  // 空的 trigger 表示过期
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "triggerMessageId" && f.reason.includes("stale")));
});

// ============================================================================
// 场景 3：无效绑定（不完整绑定）
// ============================================================================
test("对抗性：不完整绑定被拒绝", () => {
  const validator = new BindingValidator();
  const result = validator.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "",  // 缺少 conversationId
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "conversation"));
});

// ============================================================================
// 场景 4：customerUid 不匹配（独立于 conversationId）
// ============================================================================
test("对抗性：customerUid 与期望不匹配被拒绝", () => {
  const validator = new WrongTargetValidator();
  const result = validator.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    customerUid: "buyer-wrong",
    expectedCustomerUid: "buyer-correct",
  });
  assert.equal(result.valid, false);
  const failure = result.failures.find(f => f.field === "customerUid");
  assert.ok(failure);
  assert.ok(failure.reason.includes("mismatch"));
});

// ============================================================================
// 场景 5：文档版本不匹配
// ============================================================================
test("对抗性：文档版本过期被拒绝", () => {
  const validator = new WrongTargetValidator();
  const result = validator.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    documentVersion: "v1-old",
    expectedDocumentVersion: "v2-current",
  });
  assert.equal(result.valid, false);
  const failure = result.failures.find(f => f.field === "documentVersion");
  assert.ok(failure);
  assert.ok(failure.reason.includes("stale"));
});

// ============================================================================
// 场景 6：重试策略安全不变量
// ============================================================================
test("对抗性：只有 SAFE_PRE_ATTEMPT 允许重试（安全不变量）", () => {
  const classifier = new SendFailureClassifier();
  const policy = new RetryPolicy();

  // 测试所有失败类型
  const scenarios: Array<{ attempt: SendAttempt; expectedRetry: boolean }> = [
    {
      attempt: { ok: false, error: new Error("Network error") },
      expectedRetry: true,  // SAFE_PRE_ATTEMPT
    },
    {
      attempt: { ok: false, messageId: "msg-123", error: new Error("Unknown") },
      expectedRetry: false,  // ATTEMPTED_UNKNOWN
    },
    {
      attempt: { ok: false, error: new Error("Partial send") },
      expectedRetry: false,  // SIDE_EFFECT_POSSIBLE
    },
    {
      attempt: { ok: false, error: new Error("Message rejected") },
      expectedRetry: false,  // EXPLICIT_REJECTED
    },
  ];

  for (const scenario of scenarios) {
    const classification = classifier.classify(scenario.attempt);
    const decision = policy.decide(classification);
    assert.equal(
      decision.shouldRetry,
      scenario.expectedRetry,
      `Expected retry=${scenario.expectedRetry} for ${classification.failureType}`
    );
  }
});

// ============================================================================
// 场景 7：多重失败（跨店铺 + customerUid 不匹配）
// ============================================================================
test("对抗性：多重失败全部报告", () => {
  const validator = new WrongTargetValidator();
  const result = validator.validate({
    shopId: "shop-B",
    conversationId: "conv-1",
    customerUid: "buyer-wrong",
    expectedShopId: "shop-A",
    expectedCustomerUid: "buyer-correct",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.length >= 2);
  assert.ok(result.failures.some(f => f.field === "shopId"));
  assert.ok(result.failures.some(f => f.field === "customerUid"));
});

// ============================================================================
// 场景 8：所有绑定缺失
// ============================================================================
test("对抗性：所有绑定缺失被完全拒绝", () => {
  const validator = new BindingValidator();
  const result = validator.validate({
    shopId: "",
    platformAccountId: "",
    conversationId: "",
    triggerMessageId: "",
    sessionId: "",
    documentVersion: "",
  });
  assert.equal(result.valid, false);
  assert.equal(result.failures.length, 6);
});

// ============================================================================
// 场景 9：保守分类（未知错误不重试）
// ============================================================================
test("对抗性：未知错误保守分类为不重试", () => {
  const classifier = new SendFailureClassifier();
  const policy = new RetryPolicy();

  const attempt: SendAttempt = {
    ok: false,
    error: new Error("Something completely unknown happened"),
  };

  const classification = classifier.classify(attempt);
  const decision = policy.decide(classification);

  assert.equal(classification.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(decision.shouldRetry, false);
});

// ============================================================================
// 场景 10：有效上下文通过所有验证
// ============================================================================
test("对抗性：有效上下文通过所有验证", () => {
  const wrongTarget = new WrongTargetValidator();
  const binding = new BindingValidator();

  const wrongTargetResult = wrongTarget.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    customerUid: "buyer-1",
    expectedShopId: "shop-1",
    expectedCustomerUid: "buyer-1",
  });

  const bindingResult = binding.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });

  assert.equal(wrongTargetResult.valid, true);
  assert.equal(bindingResult.valid, true);
});
