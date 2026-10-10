import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAdapterIdentityEvidence } from "../dist/adapter-identity-evidence.js";

function completeEvidence() {
  return {
    evidence_id: "evidence-1",
    observed_at: "2026-10-03T00:00:00.000Z",
    source: "test-adapter",
    availability: "COMPLETE",
    runtime_shop_id: "runtime-shop-1",
    identity_lock: {
      merchant_id: "merchant-1",
      store_id: "store-1",
      platform: "pdd",
      platform_account_id: "account-1",
      customer_identity: { kind: "customerUid", value: "customer-1" },
      conversation_id: "conversation-1",
      trigger_message_id: "message-1",
    },
    session_id: "session-1",
    session_generation: "session-generation-1",
    document_generation: "document-generation-1",
  };
}

test("complete adapter evidence validates", () => {
  assert.deepEqual(validateAdapterIdentityEvidence(completeEvidence()), { valid: true, failures: [] });
});

test("partial adapter evidence is rejected", () => {
  const evidence = { ...completeEvidence(), availability: "PARTIAL" };
  const result = validateAdapterIdentityEvidence(evidence);
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.field === "availability"));
});

test("complete evidence requires session and document generations", () => {
  const evidence = completeEvidence();
  delete evidence.session_generation;
  delete evidence.document_generation;
  const result = validateAdapterIdentityEvidence(evidence);
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.field === "session_generation"));
  assert.ok(result.failures.some((failure) => failure.field === "document_generation"));
});

test("complete evidence requires a complete IdentityLock", () => {
  const evidence = completeEvidence();
  evidence.identity_lock.store_id = "";
  const result = validateAdapterIdentityEvidence(evidence);
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.field === "identity_lock.store_id"));
});
