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
import type { AuditCorrelation, AuditContext } from "../src/audit-correlation.ts";
import { createAcknowledgedOutcome } from "../src/transport-outcome.ts";
import { createConfirmationBinding } from "../src/confirmation-binding.ts";
import { createPassedVerification } from "../src/verification-record.ts";
import { createAcknowledgedNotification } from "../src/desktop-notification.ts";

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
  const binding = createConfirmationBinding(
    "req-1",
    "plan-1",
    "lock-1",
    "v1.0",
    "HUMAN_CONFIRM",
    "hash-abc"
  );

  const updated = recordConfirmation(audit, binding);

  assert.ok(updated.confirmation);
  assert.equal(updated.confirmation.request_id, "req-1");
  assert.equal(updated.confirmation.status, "PENDING");
  // 原始审计不变（不可变性）
  assert.equal(audit.confirmation, undefined);
});

test("recordVerification - 追加验证记录", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const v1 = createPassedVerification("IDENTITY_LOCK", "Identity lock verified", "plan-1");
  const v2 = createPassedVerification("POLICY_VERSION", "Policy version matched", "v1.0");

  const withV1 = recordVerification(audit, v1);
  assert.equal(withV1.verifications.length, 1);
  assert.equal(withV1.verifications[0].check_type, "IDENTITY_LOCK");

  const withV2 = recordVerification(withV1, v2);
  assert.equal(withV2.verifications.length, 2);
  assert.equal(withV2.verifications[1].check_type, "POLICY_VERSION");

  // 原始审计不变
  assert.equal(audit.verifications.length, 0);
});

test("recordOutcome - 记录运输结果", () => {
  const audit = startAudit({ shop_id: "shop-1", conversation_id: "conv-1", plan_id: "plan-1" });
  const outcome = createAcknowledgedOutcome("audit-1", "pdd-msg-123");

  const updated = recordOutcome(audit, outcome);

  assert.ok(updated.outcome);
  assert.equal(updated.outcome.outcome_type, "ACKNOWLEDGED");
  assert.equal(updated.outcome.audit_id, "audit-1");
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

  const binding = createConfirmationBinding("req-1", "plan-1", "lock-1", "v1.0", "HUMAN_CONFIRM", "hash");
  const withConfirm = recordConfirmation(audit, binding);
  assert.equal(hasConfirmation(withConfirm), true);

  const outcome = createAcknowledgedOutcome("audit-1", "msg-1");
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
  const v1 = createPassedVerification("IDENTITY_LOCK", "OK", "plan-1");
  const withV = recordVerification(audit, v1);
  assert.equal(isAuditComplete(withV), false);

  // 加上 outcome
  const outcome = createAcknowledgedOutcome("audit-1", "msg-1");
  const withO = recordOutcome(withV, outcome);
  assert.equal(isAuditComplete(withO), false);

  // 加上 notification
  const notif = createAcknowledgedNotification("audit-1", "Sent", "OK");
  const withN = recordNotification(withO, notif);
  assert.equal(isAuditComplete(withN), false);

  // 完成审计
  const completed = completeAudit(withN);
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
  const v1 = createPassedVerification("IDENTITY_LOCK", "Lock verified", "lock-1");
  const v2 = createPassedVerification("POLICY_VERSION", "Version matched", "v1.0");
  audit = recordVerification(audit, v1);
  audit = recordVerification(audit, v2);
  assert.equal(audit.verifications.length, 2);

  // 3. 记录确认
  const binding = createConfirmationBinding("req-1", "plan-1", "lock-1", "v1.0", "HUMAN_CONFIRM", "hash-xyz");
  audit = recordConfirmation(audit, binding);
  assert.ok(audit.confirmation);

  // 4. 记录运输结果
  const outcome = createAcknowledgedOutcome(audit.audit_id, "pdd-msg-999");
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
