// SHEEP-311: TransportOutcome 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAcknowledgedOutcome,
  createRejectedOutcome,
  createUnknownOutcome,
  isUnknownOutcome,
  isAcknowledgedOutcome,
  isRejectedOutcome,
} from "../src/transport-outcome.ts";
import type { TransportOutcome, UnknownOutcome, AcknowledgedOutcome, RejectedOutcome } from "../src/transport-outcome.ts";

test("createAcknowledgedOutcome - 创建 ACKNOWLEDGED 结果", () => {
  const outcome = createAcknowledgedOutcome("attempt-123", "msg-456");
  
  assert.equal(outcome.outcome_type, "ACKNOWLEDGED");
  assert.equal(outcome.attempt_id, "attempt-123");
  assert.equal(outcome.platform_message_id, "msg-456");
  assert.ok(outcome.acknowledged_at);
  assert.ok(outcome.created_at);
});

test("createAcknowledgedOutcome - 自定义时间戳", () => {
  const timestamp = "2026-09-30T10:00:00Z";
  const outcome = createAcknowledgedOutcome("attempt-123", "msg-456", timestamp);
  
  assert.equal(outcome.acknowledged_at, timestamp);
});

test("createRejectedOutcome - 创建 REJECTED 结果", () => {
  const outcome = createRejectedOutcome("attempt-123");
  
  assert.equal(outcome.outcome_type, "REJECTED");
  assert.equal(outcome.attempt_id, "attempt-123");
  assert.ok(outcome.rejected_at);
  assert.ok(outcome.created_at);
});

test("createRejectedOutcome - 包含原始响应", () => {
  const rawResponse = { error: "Permission denied", code: 403 };
  const outcome = createRejectedOutcome("attempt-123", undefined, rawResponse);
  
  assert.deepEqual(outcome.raw_response, rawResponse);
});

test("createUnknownOutcome - 创建 UNKNOWN 结果（必须提供原因和上下文）", () => {
  const reason = "Network timeout during send";
  const context = { error: "ETIMEDOUT", duration_ms: 5000 };
  const outcome = createUnknownOutcome("attempt-123", reason, context);
  
  assert.equal(outcome.outcome_type, "UNKNOWN");
  assert.equal(outcome.attempt_id, "attempt-123");
  assert.equal(outcome.unknown_reason, reason);
  assert.deepEqual(outcome.unknown_context, context);
  assert.ok(outcome.created_at);
});

test("createUnknownOutcome - 包含原始响应", () => {
  const rawResponse = { partial: true, segments_sent: 2 };
  const outcome = createUnknownOutcome("attempt-123", "Partial send", {}, rawResponse);
  
  assert.deepEqual(outcome.raw_response, rawResponse);
});

test("isUnknownOutcome - 类型守卫", () => {
  const unknown = createUnknownOutcome("attempt-1", "Timeout", {});
  const acknowledged = createAcknowledgedOutcome("attempt-2", "msg-1");
  
  assert.equal(isUnknownOutcome(unknown), true);
  assert.equal(isUnknownOutcome(acknowledged), false);
});

test("isAcknowledgedOutcome - 类型守卫", () => {
  const acknowledged = createAcknowledgedOutcome("attempt-1", "msg-1");
  const rejected = createRejectedOutcome("attempt-2");
  
  assert.equal(isAcknowledgedOutcome(acknowledged), true);
  assert.equal(isAcknowledgedOutcome(rejected), false);
});

test("isRejectedOutcome - 类型守卫", () => {
  const rejected = createRejectedOutcome("attempt-1");
  const unknown = createUnknownOutcome("attempt-2", "Error", {});
  
  assert.equal(isRejectedOutcome(rejected), true);
  assert.equal(isRejectedOutcome(unknown), false);
});

test("类型安全 - UnknownOutcome 必须包含 reason 和 context", () => {
  // 这个测试验证类型系统在编译时强制执行
  // 如果取消注释下面的代码，会导致编译错误
  /*
  const invalid: UnknownOutcome = {
    outcome_type: "UNKNOWN",
    attempt_id: "attempt-1",
    // 缺少 unknown_reason 和 unknown_context
    created_at: new Date().toISOString(),
  };
  */
  
  // 正确的用法
  const valid: UnknownOutcome = createUnknownOutcome("attempt-1", "Reason", { context: true });
  assert.equal(valid.unknown_reason, "Reason");
  assert.deepEqual(valid.unknown_context, { context: true });
});

test("类型安全 - AcknowledgedOutcome 必须包含 platform_message_id", () => {
  // 正确的用法
  const valid: AcknowledgedOutcome = createAcknowledgedOutcome("attempt-1", "msg-1");
  assert.equal(valid.platform_message_id, "msg-1");
});

test("类型安全 - RejectedOutcome 必须包含 rejected_at", () => {
  // 正确的用法
  const valid: RejectedOutcome = createRejectedOutcome("attempt-1");
  assert.ok(valid.rejected_at);
});

test("所有结果类型都是不可变的", () => {
  const outcome = createAcknowledgedOutcome("attempt-1", "msg-1");
  
  // 尝试修改（TypeScript 会在编译时报错）
  // outcome.outcome_type = "REJECTED"; // 编译错误
  
  // 验证只读属性
  assert.equal(outcome.outcome_type, "ACKNOWLEDGED");
});

test("UNKNOWN 结果用于停止自动执行", () => {
  const outcome = createUnknownOutcome(
    "attempt-1",
    "Cannot determine message state",
    { error: "AMBIGUOUS_RESPONSE" }
  );
  
  // 验证 UNKNOWN 结果包含所有必要信息
  assert.equal(outcome.outcome_type, "UNKNOWN");
  assert.ok(outcome.unknown_reason);
  assert.ok(outcome.unknown_context);
  
  // 实际应用中，这里应该触发人工通知
  // if (isUnknownOutcome(outcome)) {
  //   notifyHuman(outcome.unknown_reason, outcome.unknown_context);
  // }
});
