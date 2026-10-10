import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExecutionIntent,
  transitionExecutionIntent,
  type AdapterIdentityEvidence,
  type ExecutionIntent,
} from "@fastwork/domain";
import { PreSendGuard } from "../dist/core/pre-send-guard.js";

function identityLock() {
  return {
    merchant_id: "merchant-1",
    store_id: "store-1",
    platform: "pdd" as const,
    platform_account_id: "account-1",
    customer_identity: { kind: "customerUid" as const, value: "customer-1" },
    conversation_id: "conversation-1",
    trigger_message_id: "message-1",
    generation: 7,
  };
}

function humanInput() {
  return {
    intent_id: "intent-1",
    authorization_source: "HUMAN_CONFIRMATION" as const,
    identity_lock: identityLock(),
    plan_ref: { plan_id: "plan-1", plan_hash: "plan-hash-1" },
    policy_ref: { policy_version: "policy-1" },
    confirmation_ref: {
      confirmation_id: "confirmation-1",
      confirmation_hash: "confirmation-hash-1",
      confirmed_at: "2026-10-03T00:00:00.000Z",
      expires_at: "2026-10-03T01:00:00.000Z",
    },
    session_generation: "session-generation-1",
    document_generation: "document-generation-1",
    created_at: "2026-10-03T00:00:00.000Z",
    expires_at: "2026-10-03T02:00:00.000Z",
    nonce: "nonce-1",
  };
}

async function confirmedIntent(): Promise<ExecutionIntent> {
  const created = await createExecutionIntent(humanInput());
  return transitionExecutionIntent(
    transitionExecutionIntent(created, "PLAN_BOUND"),
    "CONFIRMED",
  );
}

async function policyIntent(): Promise<ExecutionIntent> {
  const created = await createExecutionIntent({
    ...humanInput(),
    intent_id: "intent-policy-1",
    authorization_source: "POLICY_AUTHORIZATION",
    confirmation_ref: undefined,
    nonce: "nonce-policy-1",
  });
  return transitionExecutionIntent(created, "PLAN_BOUND");
}

function evidence(overrides: Partial<AdapterIdentityEvidence> = {}): AdapterIdentityEvidence {
  return {
    evidence_id: "evidence-1",
    observed_at: "2026-10-03T00:30:00.000Z",
    source: "test-adapter",
    availability: "COMPLETE",
    runtime_shop_id: "runtime-shop-1",
    identity_lock: identityLock(),
    session_id: "session-1",
    session_generation: "session-generation-1",
    document_generation: "document-generation-1",
    ...overrides,
  };
}

function binding(intent: ExecutionIntent) {
  return {
    plan_ref: intent.plan_ref,
    policy_ref: intent.policy_ref,
    confirmation_ref: intent.confirmation_ref,
  };
}

async function evaluate(intent: ExecutionIntent, evidenceOverride: Partial<AdapterIdentityEvidence> = {}, bindingOverride?: ReturnType<typeof binding>) {
  const guard = new PreSendGuard();
  return guard.evaluate({
    intent,
    identity_evidence: evidence(evidenceOverride),
    binding_evidence: bindingOverride ?? binding(intent),
    evaluated_at: "2026-10-03T00:30:00.000Z",
  });
}

test("allows a valid HUMAN_CONFIRMATION intent", async () => {
  const result = await evaluate(await confirmedIntent());
  assert.equal(result.allowed, true);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.audit.reason_codes, []);
});

test("allows a valid POLICY_AUTHORIZATION intent", async () => {
  const result = await evaluate(await policyIntent());
  assert.equal(result.allowed, true);
  assert.deepEqual(result.failures, []);
});

test("rejects non-COMPLETE adapter evidence", async () => {
  const result = await evaluate(await confirmedIntent(), { availability: "UNREADABLE" });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("ADAPTER_EVIDENCE_PARTIAL"));
});

test("rejects customer identity mismatch", async () => {
  const lock = identityLock();
  lock.customer_identity = { kind: "customerUid", value: "customer-2" };
  const result = await evaluate(await confirmedIntent(), { identity_lock: lock });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("IDENTITY_MISMATCH"));
});

test("rejects store mismatch", async () => {
  const lock = identityLock();
  lock.store_id = "store-2";
  const result = await evaluate(await confirmedIntent(), { identity_lock: lock });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("IDENTITY_MISMATCH"));
  assert.ok(result.audit.reason_codes.includes("WRONG_TARGET_VALIDATION_FAILED"));
});

test("rejects session generation mismatch", async () => {
  const result = await evaluate(await confirmedIntent(), { session_generation: "session-generation-2" });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("SESSION_GENERATION_MISMATCH"));
});

test("rejects document generation mismatch", async () => {
  const result = await evaluate(await confirmedIntent(), { document_generation: "document-generation-2" });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("DOCUMENT_GENERATION_MISMATCH"));
});

test("rejects plan mismatch", async () => {
  const intent = await confirmedIntent();
  const result = await evaluate(intent, {}, {
    ...binding(intent),
    plan_ref: { ...intent.plan_ref, plan_hash: "changed" },
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("PLAN_MISMATCH"));
});

test("rejects policy mismatch", async () => {
  const intent = await confirmedIntent();
  const result = await evaluate(intent, {}, {
    ...binding(intent),
    policy_ref: { policy_version: "changed" },
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("POLICY_MISMATCH"));
});

test("rejects an expired intent", async () => {
  const intent = await confirmedIntent();
  const guard = new PreSendGuard();
  const result = await guard.evaluate({
    intent,
    identity_evidence: evidence(),
    binding_evidence: binding(intent),
    evaluated_at: "2026-10-03T03:00:00.000Z",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("INTENT_EXPIRED"));
});

test("rejects an invalid intent hash", async () => {
  const intent = await confirmedIntent();
  const tampered = { ...intent, intent_hash: "sha256-" + "0".repeat(64) };
  const result = await evaluate(tampered as ExecutionIntent);
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("INTENT_HASH_INVALID"));
});

test("rejects an intent in the wrong lifecycle state", async () => {
  const created = await createExecutionIntent(humanInput());
  const result = await evaluate(created);
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("INTENT_STATE_INVALID"));
});
test("rejects confirmation confirmed_at mismatch", async () => {
  const intent = await confirmedIntent();
  const confirmation = intent.confirmation_ref;
  if (!confirmation) throw new Error("missing confirmation");
  const result = await evaluate(intent, {}, {
    ...binding(intent),
    confirmation_ref: { ...confirmation, confirmed_at: "2026-10-03T00:10:00.000Z" },
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("CONFIRMATION_REPLAYED"));
});

test("rejects confirmation expires_at mismatch", async () => {
  const intent = await confirmedIntent();
  const confirmation = intent.confirmation_ref;
  if (!confirmation) throw new Error("missing confirmation");
  const result = await evaluate(intent, {}, {
    ...binding(intent),
    confirmation_ref: { ...confirmation, expires_at: "2026-10-03T00:45:00.000Z" },
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("CONFIRMATION_REPLAYED"));
});

test("rejects HUMAN_CONFIRMATION with missing binding confirmation", async () => {
  const intent = await confirmedIntent();
  const result = await evaluate(intent, {}, {
    plan_ref: intent.plan_ref,
    policy_ref: intent.policy_ref,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("CONFIRMATION_MISSING"));
});

test("rejects POLICY_AUTHORIZATION carrying confirmation evidence", async () => {
  const intent = await policyIntent();
  const result = await evaluate(intent, {}, {
    plan_ref: intent.plan_ref,
    policy_ref: intent.policy_ref,
    confirmation_ref: humanInput().confirmation_ref,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.audit.reason_codes.includes("CONFIRMATION_REPLAYED"));
});
