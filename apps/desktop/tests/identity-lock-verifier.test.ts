// SHEEP-306 P2-8b IdentityLock Verifier - unit tests.
//
// Scope: IdentityLock completeness and validity verification.
// Deterministic: pure function, no side effects, no time dependency.
// No AI, no send, no persistence, no schema change is involved in this unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyIdentityLock } from "../dist/main/services/identity-lock-verifier.js";
import type { ContractIdentityLock } from "@fastwork/domain";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createValidIdentityLock(overrides: Partial<ContractIdentityLock> = {}): ContractIdentityLock {
  return {
    merchant_id: "merchant-1",
    store_id: "store-1",
    platform: "pdd",
    platform_account_id: "account-1",
    customer_identity: {
      kind: "customerUid",
      value: "customer-123",
    },
    conversation_id: "conversation-1",
    trigger_message_id: "msg-1",
    ...overrides,
  };
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

test("verifyIdentityLock: valid lock passes verification", () => {
  const lock = createValidIdentityLock();
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("verifyIdentityLock: missing merchant_id fails", () => {
  const lock = createValidIdentityLock({ merchant_id: "" });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_merchant_id");
  assert.equal(result.errors[0].category, "identity_lock");
  assert.equal(result.errors[0].blocking, true);
});

test("verifyIdentityLock: missing store_id fails", () => {
  const lock = createValidIdentityLock({ store_id: "" });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_store_id");
});

test("verifyIdentityLock: missing platform_account_id fails", () => {
  const lock = createValidIdentityLock({ platform_account_id: "" });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_platform_account_id");
});

test("verifyIdentityLock: missing conversation_id fails", () => {
  const lock = createValidIdentityLock({ conversation_id: "" });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_conversation_id");
});

test("verifyIdentityLock: missing trigger_message_id fails", () => {
  const lock = createValidIdentityLock({ trigger_message_id: "" });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_trigger_message_id");
});

test("verifyIdentityLock: invalid platform fails", () => {
  const lock = createValidIdentityLock({ platform: "invalid_platform" as any });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_invalid_platform");
  assert.match(result.errors[0].message, /invalid_platform/);
});

test("verifyIdentityLock: valid platforms pass", () => {
  const validPlatforms: Array<"pdd" | "doudian" | "jd" | "kuaishou" | "qianniu" | "xianyu"> = [
    "pdd",
    "doudian",
    "jd",
    "kuaishou",
    "qianniu",
    "xianyu",
  ];

  for (const platform of validPlatforms) {
    const lock = createValidIdentityLock({ platform });
    const result = verifyIdentityLock(lock);
    assert.equal(result.ok, true, `Platform ${platform} should be valid`);
  }
});

test("verifyIdentityLock: missing customer_identity fails", () => {
  const lock = createValidIdentityLock({
    customer_identity: undefined as any,
  });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_customer_identity");
});

test("verifyIdentityLock: invalid customer_identity.kind fails", () => {
  const lock = createValidIdentityLock({
    customer_identity: {
      kind: "invalid_kind" as any,
      value: "customer-123",
    },
  });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_invalid_customer_kind");
  assert.match(result.errors[0].message, /invalid_kind/);
});

test("verifyIdentityLock: valid customer_identity kinds pass", () => {
  const validKinds: Array<"customerUid" | "buyer_id" | "user_id"> = [
    "customerUid",
    "buyer_id",
    "user_id",
  ];

  for (const kind of validKinds) {
    const lock = createValidIdentityLock({
      customer_identity: { kind, value: "customer-123" },
    });
    const result = verifyIdentityLock(lock);
    assert.equal(result.ok, true, `Kind ${kind} should be valid`);
  }
});

test("verifyIdentityLock: empty customer_identity.value fails", () => {
  const lock = createValidIdentityLock({
    customer_identity: {
      kind: "customerUid",
      value: "",
    },
  });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_customer_value");
});

test("verifyIdentityLock: whitespace-only customer_identity.value fails", () => {
  const lock = createValidIdentityLock({
    customer_identity: {
      kind: "customerUid",
      value: "   ",
    },
  });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].error_id, "identity_lock_missing_customer_value");
});

test("verifyIdentityLock: multiple missing fields produce multiple errors", () => {
  const lock = createValidIdentityLock({
    merchant_id: "",
    store_id: "",
    platform_account_id: "",
  });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.some((e) => e.error_id === "identity_lock_missing_merchant_id"));
  assert.ok(result.errors.some((e) => e.error_id === "identity_lock_missing_store_id"));
  assert.ok(result.errors.some((e) => e.error_id === "identity_lock_missing_platform_account_id"));
});

test("verifyIdentityLock: all errors are blocking", () => {
  const lock = createValidIdentityLock({
    merchant_id: "",
    platform: "invalid" as any,
    customer_identity: { kind: "invalid" as any, value: "" },
  });
  const result = verifyIdentityLock(lock);

  assert.equal(result.ok, false);
  for (const error of result.errors) {
    assert.equal(error.blocking, true);
    assert.equal(error.severity, "error");
  }
});
