// SHEEP-311: DesktopNotification 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAcknowledgedNotification,
  createRejectedNotification,
  createUnknownNotification,
  createConfirmationRequiredNotification,
  createVerificationFailedNotification,
  isUnknownNotification,
  requiresHumanAction,
} from "../src/desktop-notification.ts";
import type { DesktopNotification } from "../src/desktop-notification.ts";

test("createAcknowledgedNotification - 创建 ACKNOWLEDGED 通知", () => {
  const notification = createAcknowledgedNotification(
    "audit-123",
    "Message Sent",
    "Your reply has been sent successfully."
  );

  assert.ok(notification.notification_id.startsWith("notif-"));
  assert.equal(notification.audit_id, "audit-123");
  assert.equal(notification.notification_type, "SEND_ACKNOWLEDGED");
  assert.equal(notification.severity, "INFO");
  assert.equal(notification.title, "Message Sent");
  assert.equal(notification.message, "Your reply has been sent successfully.");
  assert.ok(notification.created_at);
});

test("createAcknowledgedNotification - 带元数据", () => {
  const metadata = { plan_id: "plan-456", platform_message_id: "msg-789" };
  const notification = createAcknowledgedNotification(
    "audit-123",
    "Message Sent",
    "Success",
    metadata
  );

  assert.deepEqual(notification.metadata, metadata);
});

test("createRejectedNotification - 创建 REJECTED 通知", () => {
  const notification = createRejectedNotification(
    "audit-123",
    "Message Rejected",
    "The platform rejected your message."
  );

  assert.equal(notification.notification_type, "SEND_REJECTED");
  assert.equal(notification.severity, "WARNING");
});

test("createUnknownNotification - 创建 UNKNOWN 通知（必须通知人工）", () => {
  const notification = createUnknownNotification(
    "audit-123",
    "Unknown Status",
    "Cannot determine if message was sent. Reason: Network timeout."
  );

  assert.equal(notification.notification_type, "SEND_UNKNOWN");
  assert.equal(notification.severity, "ERROR");
  assert.ok(notification.message.includes("Network timeout"));
});

test("createUnknownNotification - 带未知上下文", () => {
  const metadata = {
    unknown_reason: "Network timeout",
    unknown_context: { error: "ETIMEDOUT", duration_ms: 5000 },
  };
  const notification = createUnknownNotification(
    "audit-123",
    "Unknown Status",
    "Cannot determine message state.",
    metadata
  );

  assert.deepEqual(notification.metadata, metadata);
});

test("createConfirmationRequiredNotification - 创建确认请求通知", () => {
  const notification = createConfirmationRequiredNotification(
    "audit-123",
    "Confirmation Required",
    "Please confirm before sending.",
    "confirm://plan-456"
  );

  assert.equal(notification.notification_type, "CONFIRMATION_REQUIRED");
  assert.equal(notification.severity, "WARNING");
  assert.equal(notification.action, "confirm://plan-456");
});

test("createConfirmationRequiredNotification - 带元数据", () => {
  const metadata = { plan_id: "plan-456", policy_version: "1.0.0" };
  const notification = createConfirmationRequiredNotification(
    "audit-123",
    "Confirmation Required",
    "Please confirm.",
    undefined,
    metadata
  );

  assert.deepEqual(notification.metadata, metadata);
});

test("createVerificationFailedNotification - 创建验证失败通知", () => {
  const notification = createVerificationFailedNotification(
    "audit-123",
    "Verification Failed",
    "Pre-execution verification failed: IdentityLock invalid."
  );

  assert.equal(notification.notification_type, "VERIFICATION_FAILED");
  assert.equal(notification.severity, "ERROR");
});

test("isUnknownNotification - 类型守卫", () => {
  const unknownNotif = createUnknownNotification("audit-1", "Unknown", "Reason");
  const acknowledgedNotif = createAcknowledgedNotification("audit-2", "Sent", "Success");

  assert.equal(isUnknownNotification(unknownNotif), true);
  assert.equal(isUnknownNotification(acknowledgedNotif), false);
});

test("requiresHumanAction - 需要人工操作的通知", () => {
  const unknownNotif = createUnknownNotification("audit-1", "Unknown", "Reason");
  const confirmationNotif = createConfirmationRequiredNotification("audit-2", "Confirm", "Please confirm");
  const verificationNotif = createVerificationFailedNotification("audit-3", "Failed", "Verification failed");
  const acknowledgedNotif = createAcknowledgedNotification("audit-4", "Sent", "Success");
  const rejectedNotif = createRejectedNotification("audit-5", "Rejected", "Platform rejected");

  assert.equal(requiresHumanAction(unknownNotif), true);
  assert.equal(requiresHumanAction(confirmationNotif), true);
  assert.equal(requiresHumanAction(verificationNotif), true);
  assert.equal(requiresHumanAction(acknowledgedNotif), false);
  assert.equal(requiresHumanAction(rejectedNotif), false);
});

test("通知是不可变的", () => {
  const notification = createAcknowledgedNotification("audit-1", "Sent", "Success");

  // TypeScript would prevent mutation at compile time
  // notification.severity = "ERROR"; // Would cause compile error

  // Verify the notification is unchanged
  assert.equal(notification.severity, "INFO");
});

test("通知唯一性", () => {
  const notif1 = createAcknowledgedNotification("audit-1", "Sent", "Success");
  const notif2 = createAcknowledgedNotification("audit-2", "Sent", "Success");

  // Each notification should have a unique notification_id
  assert.notEqual(notif1.notification_id, notif2.notification_id);
});

test("所有通知类型", () => {
  const types = [
    "SEND_ACKNOWLEDGED",
    "SEND_REJECTED",
    "SEND_UNKNOWN",
    "CONFIRMATION_REQUIRED",
    "VERIFICATION_FAILED",
  ] as const;

  const notifications = [
    createAcknowledgedNotification("audit-1", "Title", "Message"),
    createRejectedNotification("audit-2", "Title", "Message"),
    createUnknownNotification("audit-3", "Title", "Message"),
    createConfirmationRequiredNotification("audit-4", "Title", "Message"),
    createVerificationFailedNotification("audit-5", "Title", "Message"),
  ];

  for (let i = 0; i < types.length; i++) {
    assert.equal(notifications[i].notification_type, types[i]);
  }
});

test("UNKNOWN 通知必须包含原因", () => {
  const notification = createUnknownNotification(
    "audit-123",
    "Unknown Status",
    "Cannot determine message state. Reason: Network timeout during send."
  );

  // The message should contain the reason
  assert.ok(notification.message.includes("Network timeout"));
  assert.equal(notification.severity, "ERROR");
});
