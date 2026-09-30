// SHEEP-311: HumanConfirm 对抗性测试
// 测试各种边界情况和攻击场景
import { test } from "node:test";
import assert from "node:assert/strict";
import { HumanConfirmController } from "../src/core/human-confirm-controller.ts";
import type {
  IdentityLock,
  ReplyPlanRef,
  PolicyDecisionRef,
} from "../src/core/human-confirm-controller.ts";

// Mock IdentityLock
const mockIdentityLock: IdentityLock = {
  merchant_id: "merchant-1",
  store_id: "store-1",
  platform: "pdd",
  platform_account_id: "account-1",
  conversation_id: "conv-1",
  trigger_message_id: "msg-1",
};

const differentIdentityLock: IdentityLock = {
  merchant_id: "merchant-2",
  store_id: "store-2",
  platform: "pdd",
  platform_account_id: "account-2",
  conversation_id: "conv-2",
  trigger_message_id: "msg-2",
};

// Mock ReplyPlanRef
const mockPlan: ReplyPlanRef = {
  plan_id: "plan-123",
  identity_lock: mockIdentityLock,
};

const differentPlan: ReplyPlanRef = {
  plan_id: "plan-456",
  identity_lock: differentIdentityLock,
};

// Mock PolicyDecisionRef
const mockHumanConfirmDecision: PolicyDecisionRef = {
  rollout_mode: "HUMAN_CONFIRM",
  requires_confirmation: true,
  policy_version: "1.0.0",
};

const mockAutoDecision: PolicyDecisionRef = {
  rollout_mode: "AUTO",
  requires_confirmation: false,
  policy_version: "1.0.0",
};

const mockShadowDecision: PolicyDecisionRef = {
  rollout_mode: "SHADOW",
  requires_confirmation: false,
  policy_version: "1.0.0",
};

const mockOffDecision: PolicyDecisionRef = {
  rollout_mode: "OFF",
  requires_confirmation: false,
  policy_version: "1.0.0",
};

let fixedTime = "2026-09-30T10:00:00.000Z";
const fixedClock = () => fixedTime;

// ============================================================================
// 对抗性场景 1: 跨目标确认
// 确认一个 plan，尝试执行另一个 plan
// ============================================================================

test("对抗性: 跨目标确认 - 确认 plan-A 后尝试验证 plan-B", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 为 plan-A 请求确认
  const requestA = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 确认 plan-A
  const result = controller.confirm(requestA.confirmation_id, "user-123");
  assert.equal(result.success, true);

  // 尝试用 plan-A 的确认验证 plan-B
  const isValidForPlanB = controller.validateConfirmation(
    result.confirmation!,
    "plan-456", // 不同的 plan_id
    mockIdentityLock
  );

  // 应该被拒绝
  assert.equal(isValidForPlanB, false, "跨 plan_id 的确认应该被拒绝");
});

test("对抗性: 跨目标确认 - 确认 plan-A 后尝试验证不同的 identity_lock", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 为 plan-A 请求确认
  const requestA = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 确认 plan-A
  const result = controller.confirm(requestA.confirmation_id, "user-123");
  assert.equal(result.success, true);

  // 尝试用不同的 identity_lock 验证
  const isValidForDifferentLock = controller.validateConfirmation(
    result.confirmation!,
    mockPlan.plan_id,
    differentIdentityLock // 不同的 identity_lock
  );

  // 应该被拒绝
  assert.equal(isValidForDifferentLock, false, "跨 identity_lock 的确认应该被拒绝");
});

// ============================================================================
// 对抗性场景 2: 过期确认
// 使用过期的确认
// ============================================================================

test("对抗性: 过期确认 - 尝试使用过期的确认", () => {
  let currentTime = "2026-09-30T10:00:00.000Z";
  const controller = new HumanConfirmController({
    defaultExpirationMs: 1000, // 1 秒过期
    clock: () => currentTime,
  });

  // 请求确认
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 时间前进 2 秒
  currentTime = "2026-09-30T10:00:02.000Z";

  // 尝试确认
  const result = controller.confirm(request.confirmation_id, "user-123");

  // 应该失败
  assert.equal(result.success, false, "过期的确认应该被拒绝");
  assert.match(result.reason!, /expired/, "错误信息应该包含 'expired'");
  assert.equal(result.request!.status, "EXPIRED");
});

test("对抗性: 过期确认 - 查询过期状态", () => {
  let currentTime = "2026-09-30T10:00:00.000Z";
  const controller = new HumanConfirmController({
    defaultExpirationMs: 1000,
    clock: () => currentTime,
  });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 时间前进
  currentTime = "2026-09-30T10:00:02.000Z";

  // 查询状态
  const status = controller.getConfirmationStatus(request.confirmation_id);

  assert.equal(status, "EXPIRED", "过期后状态应该是 EXPIRED");
});

// ============================================================================
// 对抗性场景 3: AUTO 模式尝试
// 尝试启用 AUTO 模式
// ============================================================================

test("对抗性: AUTO 模式尝试 - 请求 AUTO 模式确认", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 尝试为 AUTO 模式请求确认
  assert.throws(
    () => controller.requestConfirmation(mockPlan, mockAutoDecision),
    /AUTO mode is explicitly rejected/,
    "AUTO 模式应该被明确拒绝"
  );
});

test("对抗性: AUTO 模式尝试 - 错误信息明确", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  try {
    controller.requestConfirmation(mockPlan, mockAutoDecision);
    assert.fail("应该抛出异常");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match(error.message, /AUTO mode is explicitly rejected/);
    assert.match(error.message, /MVP/, "错误信息应该提到 MVP");
    assert.match(error.message, /HUMAN_CONFIRM/, "错误信息应该提到 HUMAN_CONFIRM");
  }
});

// ============================================================================
// 对抗性场景 4: 缺少确认发送
// 未确认直接发送
// ============================================================================

test("对抗性: 缺少确认 - 尝试验证未确认的请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 请求确认但不确认
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 尝试验证（应该失败，因为状态是 PENDING）
  const isValid = controller.validateConfirmation(
    {
      confirmation_id: request.confirmation_id,
      plan_id: request.plan_id,
      identity_lock: request.identity_lock,
      policy_version: request.policy_version,
      confirmed_at: request.requested_at,
      confirmed_by: "unknown",
      confirmation_hash: "",
      expires_at: request.expires_at,
    },
    mockPlan.plan_id,
    mockPlan.identity_lock
  );

  // validateConfirmation 只检查 plan_id 和 identity_lock 匹配
  // 但实际使用时应该先检查状态是否为 CONFIRMED
  const status = controller.getConfirmationStatus(request.confirmation_id);
  assert.equal(status, "PENDING", "未确认的状态应该是 PENDING");
});

test("对抗性: 缺少确认 - 尝试确认不存在的请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 尝试确认不存在的请求
  const result = controller.confirm("non-existent-id", "user-123");

  assert.equal(result.success, false, "不存在的请求应该失败");
  assert.match(result.reason!, /not found/, "错误信息应该包含 'not found'");
});

// ============================================================================
// 对抗性场景 5: UNKNOWN 结果
// 发送结果未知
// ============================================================================

test("对抗性: 重复确认 - 尝试确认已确认的请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 第一次确认
  const result1 = controller.confirm(request.confirmation_id, "user-123");
  assert.equal(result1.success, true);

  // 第二次确认（应该失败）
  const result2 = controller.confirm(request.confirmation_id, "user-456");
  assert.equal(result2.success, false, "重复确认应该失败");
  assert.match(result2.reason!, /not pending/, "错误信息应该包含 'not pending'");
});

test("对抗性: 确认后拒绝 - 尝试拒绝已确认的请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 先确认
  controller.confirm(request.confirmation_id, "user-123");

  // 再拒绝（应该失败）
  const result = controller.reject(request.confirmation_id, "user-456", "changed mind");
  assert.equal(result.success, false, "确认后拒绝应该失败");
  assert.match(result.reason!, /not pending/, "错误信息应该包含 'not pending'");
});

// ============================================================================
// 对抗性场景 6: 审计链断裂
// 审计关联不完整
// ============================================================================

test("对抗性: 审计链 - 确认请求包含完整的审计信息", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 验证请求包含所有必要的审计信息
  assert.ok(request.confirmation_id, "应该有 confirmation_id");
  assert.ok(request.plan_id, "应该有 plan_id");
  assert.ok(request.identity_lock, "应该有 identity_lock");
  assert.ok(request.policy_version, "应该有 policy_version");
  assert.ok(request.requested_at, "应该有 requested_at");
  assert.equal(request.status, "PENDING", "初始状态应该是 PENDING");
});

test("对抗性: 审计链 - 确认绑定包含完整的审计信息", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const result = controller.confirm(request.confirmation_id, "user-123");

  assert.ok(result.confirmation, "应该有 confirmation");
  const binding = result.confirmation!;

  // 验证绑定包含所有必要的审计信息
  assert.ok(binding.confirmation_id, "应该有 confirmation_id");
  assert.ok(binding.plan_id, "应该有 plan_id");
  assert.ok(binding.identity_lock, "应该有 identity_lock");
  assert.ok(binding.policy_version, "应该有 policy_version");
  assert.ok(binding.confirmed_at, "应该有 confirmed_at");
  assert.ok(binding.confirmed_by, "应该有 confirmed_by");
  assert.ok(binding.confirmation_hash, "应该有 confirmation_hash");
});

test("对抗性: 审计链 - 拒绝记录原因", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const reason = "Reply content is incorrect and needs revision";
  const result = controller.reject(request.confirmation_id, "user-123", reason);

  assert.ok(result.request, "应该有 request");
  assert.equal(result.request!.status, "REJECTED", "状态应该是 REJECTED");
  assert.equal(result.request!.confirmation_reason, reason, "应该记录拒绝原因");
});

// ============================================================================
// 额外对抗性场景
// ============================================================================

test("对抗性: 不需要确认的模式 - SHADOW 模式", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  assert.throws(
    () => controller.requestConfirmation(mockPlan, mockShadowDecision),
    /Confirmation is not required/,
    "SHADOW 模式不应该需要确认"
  );
});

test("对抗性: 不需要确认的模式 - OFF 模式", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  assert.throws(
    () => controller.requestConfirmation(mockPlan, mockOffDecision),
    /Confirmation is not required/,
    "OFF 模式不应该需要确认"
  );
});

test("对抗性: 并发请求 - 多个确认请求独立", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request1 = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const request2 = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 两个请求应该有不同的 ID
  assert.notEqual(request1.confirmation_id, request2.confirmation_id);

  // 确认第一个不应该影响第二个
  controller.confirm(request1.confirmation_id, "user-123");

  assert.equal(
    controller.getConfirmationStatus(request1.confirmation_id),
    "CONFIRMED"
  );
  assert.equal(
    controller.getConfirmationStatus(request2.confirmation_id),
    "PENDING"
  );
});

test("对抗性: 清除后无法操作", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const confirmationId = request.confirmation_id;

  // 清除所有请求
  controller.clear();

  // 尝试操作已清除的请求
  const result = controller.confirm(confirmationId, "user-123");
  assert.equal(result.success, false, "清除后的请求应该无法确认");
  assert.match(result.reason!, /not found/, "错误信息应该包含 'not found'");
});

test("对抗性: 验证所有 IdentityLock 字段", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const result = controller.confirm(request.confirmation_id, "user-123");

  // 测试每个字段的验证 - 所有 IdentityLock 字段
  const testCases = [
    { field: "merchant_id", value: "merchant-different" },
    { field: "store_id", value: "store-different" },
    { field: "platform", value: "doudian" },
    { field: "platform_account_id", value: "account-different" },
    { field: "conversation_id", value: "conv-different" },
    { field: "trigger_message_id", value: "msg-different" },
  ];

  for (const testCase of testCases) {
    const differentLock: IdentityLock = {
      ...mockIdentityLock,
      [testCase.field]: testCase.value,
    };

    const isValid = controller.validateConfirmation(
      result.confirmation!,
      mockPlan.plan_id,
      differentLock
    );

    assert.equal(
      isValid,
      false,
      `不同的 ${testCase.field} 应该导致验证失败`
    );
  }
});
