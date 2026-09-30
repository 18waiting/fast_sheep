// SHEEP-310: RetryPolicy 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { RetryPolicy } from "../src/policies/retry-policy.ts";
import type { SendFailureClassification } from "../src/core/send-failure-classifier.ts";

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
