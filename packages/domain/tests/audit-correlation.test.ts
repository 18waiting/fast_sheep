// SHEEP-311: AuditCorrelation 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startAudit,
  recordConfirmation,
  recordVerification,
  recordOutcome,
  recordNotification,
  completeAudit,
  failAudit,
  isAuditCompleted,
  hasConfirmation,
  hasOutcome,
  hasNotification,
  isAuditComplete,
} from "../src/audit-correlation.ts";
import type { AuditContext } from "../src/audit-correlation.ts";
import { createAcknowledgedOutcome } from "../src/transport-outcome.ts";
import { createConfirmationRequest, createConfirmationBinding } from "../src/confirmation-binding.ts";
import { createPassedVerification } from "../src/verification-record.ts";
import { createAcknowledgedNotification } from "../src/desktop-notification.ts";
import type { ContractIdentityLock } from "../src/context-envelope.ts";

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

// Helper to create a ConfirmationBinding for tests
function createTestBinding(planId: string = "plan-1") {
  const request = createConfirmationRequest(planId, mockIdentityLock, "v1.0");
  return createConfirmationBinding(request, "user-1", "hash-abc");
}

test("startAudit - 创建 IN_PROGRESS 状态的审计", () => {
  const context: AuditContext = {
    shop_id: "shop-1",
    conversation_id: "conv-1",
    plan_id: "plan-1",
  };

  const audit = startAudit(context);

  assert.ok(audit.audit_id.startsWith("audit-"));
  assert.equal(audit.shop_id, "shop-1");
  assert.equal(audit.conversation_id, "conv-1");
  assert.equal(audit.plan_id, "plan-1");
  assert.equal(audit.status, "IN_PROGRESS");
  assert.ok(audit.created_at);
  assert.equal(audit.completed_at, undefined);
  assert.equal(audit.confirmation, undefined);
  assert.deepEqual(audit.verifications, []);
  assert.equal(audit.outcome, undefined);
  assert.equal(audit.notification, undefined);
});

test("startAudit - 支持可选 metadata", () => {
  const context: AuditContext = {
    shop_id: "shop-1",
    conversation_id: "conv-1",
    plan_id: "plan-1",
    metadata: { source: "test", version: 1 },
  };

  const audit = startAudit(context);

  assert.deepEqual(audit.metadata, { source: "test", version: 1 });
});

test("recordConfirmation - 记录确认绑定", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const binding = createTestBinding();

  const updated = recordConfirmation(audit, binding);

  assert.ok(updated.confirmation);
  assert.equal(updated.confirmation.plan_id, "plan-1");
  assert.equal(updated.confirmation.confirmed_by, "user-1");
  // 原始审计不变（不可变性）
  assert.equal(audit.confirmation, undefined);
});

test("recordVerification - 追加验证记录", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const v1 = createPassedVerification("audit-1", "IDENTITY_LOCK");
  const v2 = createPassedVerification("audit-1", "BINDING");

  const withV1 = recordVerification(audit, v1);
  assert.equal(withV1.verifications.length, 1);
  assert.equal(withV1.verifications[0].verification_type, "IDENTITY_LOCK");

  const withV2 = recordVerification(withV1, v2);
  assert.equal(withV2.verifications.length, 2);
  assert.equal(withV2.verifications[1].verification_type, "BINDING");

  // 原始审计不变
  assert.equal(audit.verifications.length, 0);
});

test("recordOutcome - 记录运输结果", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const outcome = createAcknowledgedOutcome("attempt-1", "pdd-msg-123");

  const updated = recordOutcome(audit, outcome);

  assert.ok(updated.outcome);
  assert.equal(updated.outcome.outcome_type, "ACKNOWLEDGED");
  assert.equal(updated.outcome.attempt_id, "attempt-1");
  // 原始审计不变
  assert.equal(audit.outcome, undefined);
});

test("recordNotification - 记录桌面通知", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const notification = createAcknowledgedNotification("audit-1", "Sent", "Message sent");

  const updated = recordNotification(audit, notification);

  assert.ok(updated.notification);
  assert.equal(updated.notification.notification_type, "SEND_ACKNOWLEDGED");
  // 原始审计不变
  assert.equal(audit.notification, undefined);
});

test("completeAudit - 标记审计为 COMPLETED", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  const completed = completeAudit(audit);

  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completed_at);
  assert.ok(isAuditCompleted(completed));
  // 原始审计不变
  assert.equal(audit.status, "IN_PROGRESS");
});

test("failAudit - 标记审计为 FAILED 并记录原因", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  const failed = failAudit(audit, "Verification failed: identity lock mismatch");

  assert.equal(failed.status, "FAILED");
  assert.ok(failed.completed_at);
  assert.equal(failed.metadata?.failure_reason, "Verification failed: identity lock mismatch");
});

test("failAudit - 无原因时 failure_reason 为 undefined", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  const failed = failAudit(audit);

  assert.equal(failed.status, "FAILED");
  assert.equal(failed.metadata?.failure_reason, undefined);
});

test("isAuditCompleted - 类型守卫", () => {
  const inProgress = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  assert.equal(isAuditCompleted(inProgress), false);

  const completed = completeAudit(inProgress);
  assert.equal(isAuditCompleted(completed), true);

  const failed = failAudit(inProgress, "error");
  assert.equal(isAuditCompleted(failed), false);
});

test("hasConfirmation / hasOutcome / hasNotification - 类型守卫", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  assert.equal(hasConfirmation(audit), false);
  assert.equal(hasOutcome(audit), false);
  assert.equal(hasNotification(audit), false);

  const binding = createTestBinding();
  const withConfirm = recordConfirmation(audit, binding);
  assert.equal(hasConfirmation(withConfirm), true);

  const outcome = createAcknowledgedOutcome("attempt-1", "msg-1");
  const withOutcome = recordOutcome(audit, outcome);
  assert.equal(hasOutcome(withOutcome), true);

  const notif = createAcknowledgedNotification("audit-1", "Sent", "OK");
  const withNotif = recordNotification(audit, notif);
  assert.equal(hasNotification(withNotif), true);
});

test("isAuditComplete - 验证审计完整性", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  // 空审计不完整
  assert.equal(isAuditComplete(audit), false);

  // 只有 verification 不完整
  const v1 = createPassedVerification("audit-1", "IDENTITY_LOCK");
  const withV = recordVerification(audit, v1);
  assert.equal(isAuditComplete(withV), false);

  // 加上 outcome
  const outcome = createAcknowledgedOutcome("attempt-1", "msg-1");
  const withO = recordOutcome(withV, outcome);
  assert.equal(isAuditComplete(withO), false);

  // 加上 notification
  const notif = createAcknowledgedNotification("audit-1", "Sent", "OK");
  const withN = recordNotification(withO, notif);
  assert.equal(isAuditComplete(withN), false);

  // 加上 confirmation（HUMAN_CONFIRM 模式必需）
  const binding = createTestBinding("plan-1");
  const withC = recordConfirmation(withN, binding);
  assert.equal(isAuditComplete(withC), false); // 还需要 completeAudit

  // 完成审计
  const completed = completeAudit(withC);
  assert.equal(isAuditComplete(completed), true);
});

test("审计唯一性 - 每次 startAudit 生成不同的 audit_id", () => {
  const ctx: AuditContext = { shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" };
  const a1 = startAudit(ctx);
  const a2 = startAudit(ctx);

  assert.notEqual(a1.audit_id, a2.audit_id);
});

test("完整审计流程 - 端到端构建", () => {
  // 1. 开始审计
  let audit = startAudit({
    shop_id: "shop-1",
    conversation_id: "conv-1",
    plan_id: "plan-1",
  });
  assert.equal(audit.status, "IN_PROGRESS");

  // 2. 记录验证
  const v1 = createPassedVerification(audit.audit_id, "IDENTITY_LOCK");
  const v2 = createPassedVerification(audit.audit_id, "BINDING");
  audit = recordVerification(audit, v1);
  audit = recordVerification(audit, v2);
  assert.equal(audit.verifications.length, 2);

  // 3. 记录确认
  const binding = createTestBinding("plan-1");
  audit = recordConfirmation(audit, binding);
  assert.ok(audit.confirmation);

  // 4. 记录运输结果
  const outcome = createAcknowledgedOutcome("attempt-1", "pdd-msg-999");
  audit = recordOutcome(audit, outcome);
  assert.ok(audit.outcome);

  // 5. 记录通知
  const notif = createAcknowledgedNotification(audit.audit_id, "Sent", "Message delivered");
  audit = recordNotification(audit, notif);
  assert.ok(audit.notification);

  // 6. 完成审计
  audit = completeAudit(audit);
  assert.equal(audit.status, "COMPLETED");
  assert.equal(isAuditComplete(audit), true);
  assert.equal(hasConfirmation(audit), true);
  assert.equal(hasOutcome(audit), true);
  assert.equal(hasNotification(audit), true);
});

// ============================================================
// SHEEP-312: 审计链完整性补充测试
// ============================================================

test("SHEEP-312: 不可变性 — record* 函数不修改原对象", () => {
  const original = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const originalVerifications = original.verifications.length;
  const originalStatus = original.status;

  // 记录验证
  const withVerification = recordVerification(original, {
    type: "identity_lock",
    passed: true,
    timestamp: "2026-09-30T10:00:01Z",
    details: "All fields matched",
  });

  // 原对象不变
  assert.equal(original.verifications.length, originalVerifications);
  assert.equal(original.status, originalStatus);

  // 新对象有更新
  assert.equal(withVerification.verifications.length, originalVerifications + 1);
});

test("SHEEP-312: 完整审计流程 — 所有事件类型都记录", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  const withConfirmation = recordConfirmation(audit, {
    confirmation_id: "conf-1",
    plan_id: "plan-1",
    identity_lock: {
      merchant_id: "m-1",
      store_id: "s-1",
      platform: "pdd",
      platform_account_id: "pa-1",
      customer_identity: { kind: "customerUid", value: "c-1" },
      conversation_id: "conv-1",
      trigger_message_id: "msg-1",
    },
    policy_version: "1.0.0",
    confirmed_at: "2026-09-30T10:00:01Z",
    confirmed_by: "operator-1",
    confirmation_hash: "sha256-abc123",
  });

  const withVerification = recordVerification(withConfirmation, {
    type: "wrong_target",
    passed: true,
    timestamp: "2026-09-30T10:00:02Z",
    details: "All targets valid",
  });

  const withOutcome = recordOutcome(withVerification, {
    status: "delivered",
    platform_message_id: "pm-1",
    delivered_at: "2026-09-30T10:00:03Z",
  });

  const withNotification = recordNotification(withOutcome, {
    type: "send_result",
    title: "消息已发送",
    message: "消息已成功发送给客户",
    timestamp: "2026-09-30T10:00:04Z",
  });

  const completed = completeAudit(withNotification);

  // 验证完整性
  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completed_at);
  assert.ok(hasConfirmation(completed));
  assert.ok(completed.verifications.length > 0);
  assert.ok(hasOutcome(completed));
  assert.ok(hasNotification(completed));
  assert.equal(isAuditComplete(completed), true);
});

test("SHEEP-312: 审计链可追溯 — 所有事件共享 audit_id", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const auditId = audit.audit_id;

  const withVerification = recordVerification(audit, {
    type: "identity_lock",
    passed: true,
    timestamp: "2026-09-30T10:00:01Z",
  });

  const withOutcome = recordOutcome(withVerification, {
    status: "delivered",
    platform_message_id: "pm-1",
    delivered_at: "2026-09-30T10:00:02Z",
  });

  const completed = completeAudit(withOutcome);

  // 所有阶段的 audit_id 相同
  assert.equal(audit.audit_id, auditId);
  assert.equal(withVerification.audit_id, auditId);
  assert.equal(withOutcome.audit_id, auditId);
  assert.equal(completed.audit_id, auditId);
});

test("SHEEP-312: isAuditComplete — 缺少任何必需项都返回 false", () => {
  const base = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });

  // IN_PROGRESS 不完整
  assert.equal(isAuditComplete(base), false);

  // 有验证但无结果
  const withVerification = recordVerification(base, {
    type: "identity_lock",
    passed: true,
    timestamp: "2026-09-30T10:00:01Z",
  });
  assert.equal(isAuditComplete(withVerification), false);

  // 有结果但无通知
  const withOutcome = recordOutcome(withVerification, {
    status: "delivered",
    platform_message_id: "pm-1",
    delivered_at: "2026-09-30T10:00:02Z",
  });
  assert.equal(isAuditComplete(withOutcome), false);

  // COMPLETED 但缺少通知
  const completedWithoutNotification = completeAudit(withOutcome);
  assert.equal(isAuditComplete(completedWithoutNotification), false);
});
