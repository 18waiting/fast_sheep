// SHEEP-311: HumanConfirmController 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { HumanConfirmController } from "../src/core/human-confirm-controller.ts";
import type {
  IdentityLock,
  CustomerIdentity,
  ReplyPlanRef,
  PolicyDecisionRef,
  HumanConfirmControllerOptions,
} from "../src/core/human-confirm-controller.ts";

// Mock IdentityLock for testing
const mockCustomerIdentity: CustomerIdentity = {
  kind: "customerUid",
  value: "customer-1",
};

const mockIdentityLock: IdentityLock = {
  merchant_id: "merchant-1",
  store_id: "store-1",
  platform: "pdd",
  platform_account_id: "account-1",
  customer_identity: mockCustomerIdentity,
  conversation_id: "conv-1",
  trigger_message_id: "msg-1",
  generation: 1,
};

// Mock ReplyPlanRef
const mockPlan: ReplyPlanRef = {
  plan_id: "plan-123",
  identity_lock: mockIdentityLock,
};

// Mock PolicyDecisionRef for HUMAN_CONFIRM mode
const mockHumanConfirmDecision: PolicyDecisionRef = {
  rollout_mode: "HUMAN_CONFIRM",
  requires_confirmation: true,
  policy_version: "1.0.0",
};

// Mock PolicyDecisionRef for AUTO mode
const mockAutoDecision: PolicyDecisionRef = {
  rollout_mode: "AUTO",
  requires_confirmation: false,
  policy_version: "1.0.0",
};

// Mock PolicyDecisionRef for SHADOW mode
const mockShadowDecision: PolicyDecisionRef = {
  rollout_mode: "SHADOW",
  requires_confirmation: false,
  policy_version: "1.0.0",
};

// Fixed clock for deterministic tests
let fixedTime = "2026-09-30T10:00:00.000Z";
const fixedClock = () => fixedTime;

test("requestConfirmation - 创建 PENDING 确认请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  assert.ok(request.confirmation_id.startsWith("conf-"));
  assert.equal(request.plan_id, "plan-123");
  assert.deepEqual(request.identity_lock, mockIdentityLock);
  assert.equal(request.policy_version, "1.0.0");
  assert.equal(request.status, "PENDING");
  assert.ok(request.requested_at);
  assert.equal(controller.pendingCount, 1);
});

test("requestConfirmation - AUTO 模式抛出异常", () => {
  const controller = new HumanConfirmController();

  assert.throws(
    () => controller.requestConfirmation(mockPlan, mockAutoDecision),
    /AUTO mode is explicitly rejected/
  );
});

test("requestConfirmation - 不需要确认的模式抛出异常", () => {
  const controller = new HumanConfirmController();

  assert.throws(
    () => controller.requestConfirmation(mockPlan, mockShadowDecision),
    /Confirmation is not required/
  );
});

test("requestConfirmation - 带过期时间", () => {
  const controller = new HumanConfirmController({
    defaultExpirationMs: 3600000, // 1 hour
    clock: fixedClock,
  });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  assert.ok(request.expires_at);
  assert.ok(new Date(request.expires_at!) > new Date(fixedTime));
});

test("confirm - 成功确认", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  const result = controller.confirm(request.confirmation_id, "user-123");

  assert.equal(result.success, true);
  assert.ok(result.confirmation);
  assert.equal(result.confirmation!.confirmation_id, request.confirmation_id);
  assert.equal(result.confirmation!.plan_id, "plan-123");
  assert.equal(result.confirmation!.confirmed_by, "user-123");
  assert.ok(result.confirmation!.confirmation_hash.startsWith("sha256-"));
  assert.equal(result.request!.status, "CONFIRMED");
});

test("confirm - 请求不存在", () => {
  const controller = new HumanConfirmController();

  const result = controller.confirm("non-existent-id", "user-123");

  assert.equal(result.success, false);
  assert.match(result.reason!, /not found/);
});

test("confirm - 请求已确认（非 PENDING）", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 第一次确认成功
  controller.confirm(request.confirmation_id, "user-123");

  // 第二次确认失败
  const result = controller.confirm(request.confirmation_id, "user-456");

  assert.equal(result.success, false);
  assert.match(result.reason!, /not pending/);
});

test("confirm - 请求已过期", () => {
  let currentTime = "2026-09-30T10:00:00.000Z";
  const controller = new HumanConfirmController({
    defaultExpirationMs: 1000, // 1 second
    clock: () => currentTime,
  });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 时间前进 2 秒
  currentTime = "2026-09-30T10:00:02.000Z";

  const result = controller.confirm(request.confirmation_id, "user-123");

  assert.equal(result.success, false);
  assert.match(result.reason!, /expired/);
  assert.equal(result.request!.status, "EXPIRED");
});

test("reject - 成功拒绝", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  const result = controller.reject(request.confirmation_id, "user-123", "Reply content is incorrect");

  assert.equal(result.success, true);
  assert.equal(result.request!.status, "REJECTED");
  assert.equal(result.request!.confirmation_reason, "Reply content is incorrect");
});

test("reject - 请求不存在", () => {
  const controller = new HumanConfirmController();

  const result = controller.reject("non-existent-id", "user-123", "reason");

  assert.equal(result.success, false);
  assert.match(result.reason!, /not found/);
});

test("reject - 请求非 PENDING 状态", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 先确认
  controller.confirm(request.confirmation_id, "user-123");

  // 再拒绝失败
  const result = controller.reject(request.confirmation_id, "user-456", "reason");

  assert.equal(result.success, false);
  assert.match(result.reason!, /not pending/);
});

test("getConfirmationStatus - 查询各状态", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // NOT_FOUND
  assert.equal(controller.getConfirmationStatus("non-existent"), "NOT_FOUND");

  // PENDING
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  assert.equal(controller.getConfirmationStatus(request.confirmation_id), "PENDING");

  // CONFIRMED
  controller.confirm(request.confirmation_id, "user-123");
  assert.equal(controller.getConfirmationStatus(request.confirmation_id), "CONFIRMED");

  // REJECTED
  const request2 = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  controller.reject(request2.confirmation_id, "user-123", "reason");
  assert.equal(controller.getConfirmationStatus(request2.confirmation_id), "REJECTED");
});

test("getConfirmationStatus - 过期检测", () => {
  let currentTime = "2026-09-30T10:00:00.000Z";
  const controller = new HumanConfirmController({
    defaultExpirationMs: 1000,
    clock: () => currentTime,
  });

  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 时间前进
  currentTime = "2026-09-30T10:00:02.000Z";

  assert.equal(controller.getConfirmationStatus(request.confirmation_id), "EXPIRED");
});

test("validateConfirmation - 正确匹配", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const result = controller.confirm(request.confirmation_id, "user-123");

  const isValid = controller.validateConfirmation(
    result.confirmation!,
    "plan-123",
    mockIdentityLock
  );

  assert.equal(isValid, true);
});

test("validateConfirmation - plan_id 不匹配", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const result = controller.confirm(request.confirmation_id, "user-123");

  const isValid = controller.validateConfirmation(
    result.confirmation!,
    "wrong-plan-id",
    mockIdentityLock
  );

  assert.equal(isValid, false);
});

test("validateConfirmation - identity_lock 不匹配（不同 conversation）", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const result = controller.confirm(request.confirmation_id, "user-123");

  const differentLock: IdentityLock = {
    ...mockIdentityLock,
    conversation_id: "conv-different",
  };

  const isValid = controller.validateConfirmation(
    result.confirmation!,
    "plan-123",
    differentLock
  );

  assert.equal(isValid, false);
});

test("validateConfirmation - identity_lock 不匹配（不同 merchant）", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  const result = controller.confirm(request.confirmation_id, "user-123");

  const differentLock: IdentityLock = {
    ...mockIdentityLock,
    merchant_id: "merchant-different",
  };

  const isValid = controller.validateConfirmation(
    result.confirmation!,
    "plan-123",
    differentLock
  );

  assert.equal(isValid, false);
});

test("clear - 清除所有请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  assert.equal(controller.pendingCount, 2);

  controller.clear();

  assert.equal(controller.pendingCount, 0);
});

test("getRequest - 获取请求", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  const retrieved = controller.getRequest(request.confirmation_id);

  assert.ok(retrieved);
  assert.equal(retrieved.confirmation_id, request.confirmation_id);
  assert.equal(retrieved.plan_id, "plan-123");
});

test("getRequest - 不存在返回 undefined", () => {
  const controller = new HumanConfirmController();

  const retrieved = controller.getRequest("non-existent");

  assert.equal(retrieved, undefined);
});

test("完整流程 - 请求、确认、验证", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 1. 请求确认
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);
  assert.equal(request.status, "PENDING");

  // 2. 人类确认
  const result = controller.confirm(request.confirmation_id, "user-123");
  assert.equal(result.success, true);
  assert.ok(result.confirmation);

  // 3. 验证确认
  const isValid = controller.validateConfirmation(
    result.confirmation!,
    mockPlan.plan_id,
    mockPlan.identity_lock
  );
  assert.equal(isValid, true);

  // 4. 状态查询
  assert.equal(controller.getConfirmationStatus(request.confirmation_id), "CONFIRMED");
});

test("完整流程 - 请求、拒绝", () => {
  const controller = new HumanConfirmController({ clock: fixedClock });

  // 1. 请求确认
  const request = controller.requestConfirmation(mockPlan, mockHumanConfirmDecision);

  // 2. 人类拒绝
  const result = controller.reject(request.confirmation_id, "user-123", "Content needs revision");
  assert.equal(result.success, true);
  assert.equal(result.request!.status, "REJECTED");

  // 3. 状态查询
  assert.equal(controller.getConfirmationStatus(request.confirmation_id), "REJECTED");
});
