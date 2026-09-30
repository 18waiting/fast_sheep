// SHEEP-310: SendFailureClassifier 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { SendFailureClassifier } from "../src/core/send-failure-classifier.ts";
import type { SendAttempt } from "../src/ports/platform-adapter.ts";

test("成功发送 - 返回非重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: true, messageId: "msg-123" };
  const result = classifier.classify(attempt);
  assert.equal(result.retryAllowed, false);
  assert.ok(result.reason.includes("succeeded"));
});

test("SAFE_PRE_ATTEMPT - 网络错误允许重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Network error: connection failed") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SAFE_PRE_ATTEMPT");
  assert.equal(result.retryAllowed, true);
});

test("SAFE_PRE_ATTEMPT - 连接拒绝允许重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("ECONNREFUSED: Connection refused") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SAFE_PRE_ATTEMPT");
  assert.equal(result.retryAllowed, true);
});

test("SAFE_PRE_ATTEMPT - DNS 错误允许重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("ENOTFOUND: DNS lookup failed") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SAFE_PRE_ATTEMPT");
  assert.equal(result.retryAllowed, true);
});

test("SAFE_PRE_ATTEMPT - 发送前超时允许重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Timeout before send: request timeout") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SAFE_PRE_ATTEMPT");
  assert.equal(result.retryAllowed, true);
});

test("ATTEMPTED_UNKNOWN - 有 messageId 但失败禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, messageId: "msg-123", error: new Error("Unknown error") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(result.retryAllowed, false);
});

test("ATTEMPTED_UNKNOWN - 未知错误禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Something went wrong") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(result.retryAllowed, false);
});

test("SIDE_EFFECT_POSSIBLE - 部分发送禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Partial send: 2/5 segments sent") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SIDE_EFFECT_POSSIBLE");
  assert.equal(result.retryAllowed, false);
});

test("SIDE_EFFECT_POSSIBLE - 发送中断禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Send interrupted by connection loss") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SIDE_EFFECT_POSSIBLE");
  assert.equal(result.retryAllowed, false);
});

test("EXPLICIT_REJECTED - 平台拒绝禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Message rejected by platform") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "EXPLICIT_REJECTED");
  assert.equal(result.retryAllowed, false);
});

test("EXPLICIT_REJECTED - 权限拒绝禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Permission denied: not authorized") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "EXPLICIT_REJECTED");
  assert.equal(result.retryAllowed, false);
});

test("EXPLICIT_REJECTED - 频率限制禁止重试", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("Rate limit exceeded") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "EXPLICIT_REJECTED");
  assert.equal(result.retryAllowed, false);
});

test("错误标准化 - 字符串错误", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: "Network error occurred" };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SAFE_PRE_ATTEMPT");
  assert.equal(result.retryAllowed, true);
  assert.ok(result.error instanceof Error);
});

test("错误标准化 - 对象错误", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: { message: "Connection refused" } };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "SAFE_PRE_ATTEMPT");
  assert.equal(result.retryAllowed, true);
});

test("错误标准化 - 未知错误类型", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: 12345 };
  const result = classifier.classify(attempt);
  assert.ok(result.error instanceof Error);
  assert.equal(result.error?.message, "Unknown error");
});

test("边界 - 没有 error 字段的失败", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(result.retryAllowed, false);
});

test("边界 - 空错误消息", () => {
  const classifier = new SendFailureClassifier();
  const attempt: SendAttempt = { ok: false, error: new Error("") };
  const result = classifier.classify(attempt);
  assert.equal(result.failureType, "ATTEMPTED_UNKNOWN");
  assert.equal(result.retryAllowed, false);
});
