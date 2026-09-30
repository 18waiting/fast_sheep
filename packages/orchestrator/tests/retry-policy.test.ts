// SHEEP-310: RetryPolicy 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { RetryPolicy } from "../src/policies/retry-policy.ts";
import { SendFailureClassifier, type SendFailureClassification } from "../src/core/send-failure-classifier.ts";

test("SAFE_PRE_ATTEMPT - 允许重试", () => {
  const policy = new RetryPolicy();
  const classification: SendFailureClassification = {
    failureType: "SAFE_PRE_ATTEMPT",
    retryAllowed: true,
    reason: "Network error - message was not sent",
  };
  const decision = policy.decide(classification);
  assert.equal(decision.shouldRetry, true);
  assert.ok(decision.reason.includes("Safe pre-attempt"));
});

test("ATTEMPTED_UNKNOWN - 禁止重试", () => {
  const policy = new RetryPolicy();
  const classification: SendFailureClassification = {
    failureType: "ATTEMPTED_UNKNOWN",
    retryAllowed: false,
    reason: "Message may have been sent",
  };
  const decision = policy.decide(classification);
  assert.equal(decision.shouldRetry, false);
  assert.ok(decision.reason.includes("ATTEMPTED_UNKNOWN"));
});

test("SIDE_EFFECT_POSSIBLE - 禁止重试", () => {
  const policy = new RetryPolicy();
  const classification: SendFailureClassification = {
    failureType: "SIDE_EFFECT_POSSIBLE",
    retryAllowed: false,
    reason: "Partial send",
  };
  const decision = policy.decide(classification);
  assert.equal(decision.shouldRetry, false);
  assert.ok(decision.reason.includes("SIDE_EFFECT_POSSIBLE"));
});

test("EXPLICIT_REJECTED - 禁止重试", () => {
  const policy = new RetryPolicy();
  const classification: SendFailureClassification = {
    failureType: "EXPLICIT_REJECTED",
    retryAllowed: false,
    reason: "Platform rejected the message",
  };
  const decision = policy.decide(classification);
  assert.equal(decision.shouldRetry, false);
  assert.ok(decision.reason.includes("EXPLICIT_REJECTED"));
});

test("核心不变量：只有 SAFE_PRE_ATTEMPT 允许重试", () => {
  const policy = new RetryPolicy();
  const types: Array<SendFailureClassification["failureType"]> = [
    "SAFE_PRE_ATTEMPT",
    "ATTEMPTED_UNKNOWN",
    "SIDE_EFFECT_POSSIBLE",
    "EXPLICIT_REJECTED",
  ];

  for (const type of types) {
    const classification: SendFailureClassification = {
      failureType: type,
      retryAllowed: type === "SAFE_PRE_ATTEMPT",
      reason: `Test for ${type}`,
    };
    const decision = policy.decide(classification);

    if (type === "SAFE_PRE_ATTEMPT") {
      assert.equal(decision.shouldRetry, true, `${type} should allow retry`);
    } else {
      assert.equal(decision.shouldRetry, false, `${type} should NOT allow retry`);
    }
  }
});

// ============================================================
// SHEEP-312: UNKNOWN 语义对抗性补充测试
// ============================================================

test("SHEEP-312: ATTEMPTED_UNKNOWN 的 retryAllowed 字段被忽略 — 只检查 failureType", () => {
  const policy = new RetryPolicy();
  // 即使 retryAllowed 被错误设置为 true，policy 仍然应该拒绝
  const classification: SendFailureClassification = {
    failureType: "ATTEMPTED_UNKNOWN",
    retryAllowed: true, // 故意设置错误
    reason: "Manipulated retryAllowed",
  };
  const decision = policy.decide(classification);
  assert.equal(decision.shouldRetry, false, "ATTEMPTED_UNKNOWN 必须禁止重试，无论 retryAllowed 字段");
});

test("SHEEP-312: 所有非 SAFE_PRE_ATTEMPT 类型都被拒绝 — 穷举验证", () => {
  const policy = new RetryPolicy();
  const nonRetryableTypes: Array<SendFailureClassification["failureType"]> = [
    "ATTEMPTED_UNKNOWN",
    "SIDE_EFFECT_POSSIBLE",
    "EXPLICIT_REJECTED",
  ];

  for (const type of nonRetryableTypes) {
    const classification: SendFailureClassification = {
      failureType: type,
      retryAllowed: false,
      reason: `Test ${type}`,
    };
    const decision = policy.decide(classification);
    assert.equal(decision.shouldRetry, false, `${type} must never retry`);
    assert.ok(decision.reason.includes(type), `Reason should mention ${type}`);
  }
});

test("SHEEP-312: 端到端 — 未知错误从分类到重试决策的完整链路", () => {
  const classifier = new SendFailureClassifier();
  const policy = new RetryPolicy();

  // 模拟一个完全未知的错误
  const attempt = { ok: false as const, error: new Error("xyz_unknown_error_12345") };
  const classification = classifier.classify(attempt);
  const decision = policy.decide(classification);

  assert.equal(classification.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(classification.retryAllowed, false);
  assert.equal(decision.shouldRetry, false);
  assert.ok(decision.reason.includes("ATTEMPTED_UNKNOWN"));
});

test("SHEEP-312: 端到端 — 有 messageId 的失败从分类到重试决策的完整链路", () => {
  const classifier = new SendFailureClassifier();
  const policy = new RetryPolicy();

  // 有 messageId 意味着消息可能已发送
  const attempt = { ok: false as const, messageId: "msg-already-sent", error: new Error("timeout") };
  const classification = classifier.classify(attempt);
  const decision = policy.decide(classification);

  assert.equal(classification.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(decision.shouldRetry, false, "有 messageId 的失败绝不能重试");
});
