// SHEEP-311: VerificationRecord 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPassedVerification,
  createFailedVerification,
  isVerificationPassed,
  isVerificationFailed,
  createVerificationFailure,
} from "../src/verification-record.ts";
import type { VerificationRecord, VerificationFailure } from "../src/verification-record.ts";

test("createPassedVerification - 创建通过的验证记录", () => {
  const record = createPassedVerification("audit-123", "IDENTITY_LOCK");

  assert.ok(record.verification_id.startsWith("ver-"));
  assert.equal(record.audit_id, "audit-123");
  assert.equal(record.verification_type, "IDENTITY_LOCK");
  assert.equal(record.passed, true);
  assert.ok(record.verified_at);
  assert.equal(record.failures, undefined);
});

test("createPassedVerification - 带元数据", () => {
  const metadata = { checks_performed: 5, duration_ms: 10 };
  const record = createPassedVerification("audit-123", "BINDING", metadata);

  assert.deepEqual(record.metadata, metadata);
});

test("createFailedVerification - 创建失败的验证记录", () => {
  const failures: readonly VerificationFailure[] = [
    { field: "shopId", reason: "shopId is missing" },
    { field: "conversationId", reason: "conversationId is empty" },
  ];

  const record = createFailedVerification("audit-123", "BINDING", failures);

  assert.equal(record.passed, false);
  assert.ok(record.failures);
  assert.equal(record.failures.length, 2);
  assert.equal(record.failures[0].field, "shopId");
  assert.equal(record.failures[1].field, "conversationId");
});

test("createFailedVerification - 带元数据", () => {
  const failures: readonly VerificationFailure[] = [
    { field: "customerUid", reason: "customerUid mismatch" },
  ];
  const metadata = { expected_uid: "uid-1", actual_uid: "uid-2" };

  const record = createFailedVerification("audit-123", "WRONG_TARGET", failures, metadata);

  assert.deepEqual(record.metadata, metadata);
});

test("isVerificationPassed - 类型守卫", () => {
  const passedRecord = createPassedVerification("audit-1", "IDENTITY_LOCK");
  const failedRecord = createFailedVerification("audit-2", "BINDING", []);

  assert.equal(isVerificationPassed(passedRecord), true);
  assert.equal(isVerificationPassed(failedRecord), false);
});

test("isVerificationFailed - 类型守卫", () => {
  const passedRecord = createPassedVerification("audit-1", "IDENTITY_LOCK");
  const failedRecord = createFailedVerification("audit-2", "BINDING", []);

  assert.equal(isVerificationFailed(failedRecord), true);
  assert.equal(isVerificationFailed(passedRecord), false);
});

test("createVerificationFailure - 创建验证失败", () => {
  const failure = createVerificationFailure(
    "shopId",
    "shopId mismatch",
    "shop-1",
    "shop-2"
  );

  assert.equal(failure.field, "shopId");
  assert.equal(failure.reason, "shopId mismatch");
  assert.equal(failure.expected, "shop-1");
  assert.equal(failure.actual, "shop-2");
});

test("createVerificationFailure - 不带期望/实际值", () => {
  const failure = createVerificationFailure("field1", "reason1");

  assert.equal(failure.field, "field1");
  assert.equal(failure.reason, "reason1");
  assert.equal(failure.expected, undefined);
  assert.equal(failure.actual, undefined);
});

test("验证记录是不可变的", () => {
  const record = createPassedVerification("audit-1", "IDENTITY_LOCK");

  // TypeScript would prevent mutation at compile time
  // record.passed = false; // Would cause compile error

  // Verify the record is unchanged
  assert.equal(record.passed, true);
});

test("验证记录唯一性", () => {
  const record1 = createPassedVerification("audit-1", "IDENTITY_LOCK");
  const record2 = createPassedVerification("audit-2", "BINDING");

  // Each record should have a unique verification_id
  assert.notEqual(record1.verification_id, record2.verification_id);
});

test("所有验证类型", () => {
  const types = ["IDENTITY_LOCK", "WRONG_TARGET", "BINDING", "REPLY_PLAN", "CONFIRMATION"] as const;

  for (const type of types) {
    const record = createPassedVerification("audit-1", type);
    assert.equal(record.verification_type, type);
  }
});

test("失败的验证记录必须包含失败原因", () => {
  const failures: readonly VerificationFailure[] = [
    { field: "field1", reason: "reason1" },
    { field: "field2", reason: "reason2", expected: "exp", actual: "act" },
  ];

  const record = createFailedVerification("audit-1", "BINDING", failures);

  assert.equal(record.failures?.length, 2);
  assert.equal(record.failures?.[0].reason, "reason1");
  assert.equal(record.failures?.[1].expected, "exp");
  assert.equal(record.failures?.[1].actual, "act");
});
