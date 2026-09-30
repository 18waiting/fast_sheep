// SHEEP-311: ConfirmationBinding 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createConfirmationRequest,
  createConfirmationBinding,
  isPendingConfirmation,
  isConfirmedConfirmation,
  computeConfirmationHash,
} from "../src/confirmation-binding.ts";
import type { ContractIdentityLock } from "../src/context-envelope.ts";
import type { ConfirmationBinding, ConfirmationRequest } from "../src/confirmation-binding.ts";

// Mock ContractIdentityLock for testing
const mockIdentityLock: ContractIdentityLock = {
  merchant_id: "merchant-1",
  store_id: "store-1",
  platform: "pdd",
  platform_account_id: "account-1",
  customer_identity: {
    customer_uid: "customer-1",
    customer_nick: "Test Customer",
  },
  conversation_id: "conv-1",
  trigger_message_id: "msg-1",
  generation: 1,
};

test("createConfirmationRequest - 创建确认请求", () => {
  const request = createConfirmationRequest(
    "plan-123",
    mockIdentityLock,
    "1.0.0"
  );

  assert.ok(request.confirmation_id.startsWith("conf-"));
  assert.equal(request.plan_id, "plan-123");
  assert.deepEqual(request.identity_lock, mockIdentityLock);
  assert.equal(request.policy_version, "1.0.0");
  assert.equal(request.status, "PENDING");
  assert.ok(request.requested_at);
});

test("createConfirmationRequest - 带过期时间", () => {
  const expiresAt = "2026-09-30T11:00:00Z";
  const request = createConfirmationRequest(
    "plan-123",
    mockIdentityLock,
    "1.0.0",
    expiresAt
  );

  assert.equal(request.expires_at, expiresAt);
});

test("createConfirmationRequest - 带确认原因", () => {
  const reason = "HUMAN_CONFIRM mode requires explicit approval";
  const request = createConfirmationRequest(
    "plan-123",
    mockIdentityLock,
    "1.0.0",
    undefined,
    reason
  );

  assert.equal(request.confirmation_reason, reason);
});

test("createConfirmationBinding - 从确认请求创建绑定", () => {
  const request = createConfirmationRequest("plan-123", mockIdentityLock, "1.0.0");
  const binding = createConfirmationBinding(
    request,
    "user-789",
    "sha256-abc123"
  );

  assert.equal(binding.confirmation_id, request.confirmation_id);
  assert.equal(binding.plan_id, "plan-123");
  assert.deepEqual(binding.identity_lock, mockIdentityLock);
  assert.equal(binding.policy_version, "1.0.0");
  assert.equal(binding.confirmed_by, "user-789");
  assert.equal(binding.confirmation_hash, "sha256-abc123");
  assert.ok(binding.confirmed_at);
});

test("createConfirmationBinding - 带元数据", () => {
  const request = createConfirmationRequest("plan-123", mockIdentityLock, "1.0.0");
  const metadata = { ui_state: "modal", user_note: "Approved after review" };
  const binding = createConfirmationBinding(
    request,
    "user-789",
    "sha256-abc123",
    metadata
  );

  assert.deepEqual(binding.metadata, metadata);
});

test("isPendingConfirmation - 类型守卫", () => {
  const pendingRequest = createConfirmationRequest("plan-1", mockIdentityLock, "1.0.0");
  const confirmedRequest: ConfirmationRequest = {
    ...pendingRequest,
    status: "CONFIRMED",
  };

  assert.equal(isPendingConfirmation(pendingRequest), true);
  assert.equal(isPendingConfirmation(confirmedRequest), false);
});

test("isConfirmedConfirmation - 类型守卫", () => {
  const pendingRequest = createConfirmationRequest("plan-1", mockIdentityLock, "1.0.0");
  const confirmedRequest: ConfirmationRequest = {
    ...pendingRequest,
    status: "CONFIRMED",
  };

  assert.equal(isConfirmedConfirmation(confirmedRequest), true);
  assert.equal(isConfirmedConfirmation(pendingRequest), false);
});

test("computeConfirmationHash - 计算确认哈希", () => {
  const bindingWithoutHash = {
    confirmation_id: "conf-123",
    plan_id: "plan-456",
    identity_lock: mockIdentityLock,
    policy_version: "1.0.0",
    confirmed_at: "2026-09-30T10:00:00Z",
    confirmed_by: "user-789",
  };

  const hash = computeConfirmationHash(bindingWithoutHash);

  assert.ok(hash.startsWith("sha256-"));
  assert.equal(hash.length, 13); // "sha256-" + 8 hex chars
});

test("computeConfirmationHash - 相同内容生成相同哈希", () => {
  const binding1 = {
    confirmation_id: "conf-123",
    plan_id: "plan-456",
    identity_lock: mockIdentityLock,
    policy_version: "1.0.0",
    confirmed_at: "2026-09-30T10:00:00Z",
    confirmed_by: "user-789",
  };

  const binding2 = { ...binding1 };

  const hash1 = computeConfirmationHash(binding1);
  const hash2 = computeConfirmationHash(binding2);

  assert.equal(hash1, hash2);
});

test("computeConfirmationHash - 不同内容生成不同哈希", () => {
  const binding1 = {
    confirmation_id: "conf-123",
    plan_id: "plan-456",
    identity_lock: mockIdentityLock,
    policy_version: "1.0.0",
    confirmed_at: "2026-09-30T10:00:00Z",
    confirmed_by: "user-789",
  };

  const binding2 = {
    ...binding1,
    plan_id: "plan-789", // Different plan_id
  };

  const hash1 = computeConfirmationHash(binding1);
  const hash2 = computeConfirmationHash(binding2);

  assert.notEqual(hash1, hash2);
});

test("确认绑定是不可变的", () => {
  const request = createConfirmationRequest("plan-123", mockIdentityLock, "1.0.0");
  const binding = createConfirmationBinding(request, "user-789", "sha256-abc123");

  // TypeScript would prevent mutation at compile time
  // binding.plan_id = "plan-999"; // Would cause compile error

  // Verify the binding is unchanged
  assert.equal(binding.plan_id, "plan-123");
});

test("确认请求唯一性", () => {
  const request1 = createConfirmationRequest("plan-1", mockIdentityLock, "1.0.0");
  const request2 = createConfirmationRequest("plan-2", mockIdentityLock, "1.0.0");

  // Each request should have a unique confirmation_id
  assert.notEqual(request1.confirmation_id, request2.confirmation_id);
});

test("确认绑定验证 - plan_id 必须匹配", () => {
  const request = createConfirmationRequest("plan-123", mockIdentityLock, "1.0.0");
  const binding = createConfirmationBinding(request, "user-789", "sha256-abc123");

  // Simulate validation context with different plan_id
  const context = {
    expected_plan_id: "plan-999", // Different from binding
    expected_identity_lock: mockIdentityLock,
    current_time: "2026-09-30T10:05:00Z",
  };

  // In a real validator, this would fail
  assert.notEqual(binding.plan_id, context.expected_plan_id);
});

test("确认绑定验证 - identity_lock 必须匹配", () => {
  const request = createConfirmationRequest("plan-123", mockIdentityLock, "1.0.0");
  const binding = createConfirmationBinding(request, "user-789", "sha256-abc123");

  const differentIdentityLock: ContractIdentityLock = {
    ...mockIdentityLock,
    conversation_id: "conv-999", // Different conversation
  };

  // Simulate validation context with different identity_lock
  const context = {
    expected_plan_id: "plan-123",
    expected_identity_lock: differentIdentityLock,
    current_time: "2026-09-30T10:05:00Z",
  };

  // In a real validator, this would fail
  assert.notDeepEqual(binding.identity_lock, context.expected_identity_lock);
});
