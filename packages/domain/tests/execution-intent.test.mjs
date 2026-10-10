import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExecutionIntent,
  verifyExecutionIntentHash,
  validateExecutionIntent,
  transitionExecutionIntent,
  isExecutionIntentTransitionAllowed,
} from "../dist/execution-intent.js";

function identityLock() {
  return {
    merchant_id: "merchant-1",
    store_id: "store-1",
    platform: "pdd",
    platform_account_id: "account-1",
    customer_identity: { kind: "customerUid", value: "customer-1" },
    conversation_id: "conversation-1",
    trigger_message_id: "message-1",
    generation: 7,
  };
}

function humanInput() {
  return {
    intent_id: "intent-1",
    authorization_source: "HUMAN_CONFIRMATION",
    identity_lock: identityLock(),
    plan_ref: { plan_id: "plan-1", plan_hash: "plan-hash-1" },
    policy_ref: { policy_version: "policy-1" },
    confirmation_ref: {
      confirmation_id: "confirmation-1",
      confirmation_hash: "confirmation-hash-1",
      confirmed_at: "2026-10-03T00:00:00.000Z",
      expires_at: "2026-10-03T01:00:00.000Z",
    },
    session_generation: "session-7",
    document_generation: "document-9",
    created_at: "2026-10-03T00:00:00.000Z",
    expires_at: "2026-10-03T02:00:00.000Z",
    nonce: "nonce-1",
  };
}

function policyInput() {
  const input = humanInput();
  delete input.confirmation_ref;
  return {
    ...input,
    intent_id: "intent-policy-1",
    authorization_source: "POLICY_AUTHORIZATION",
    nonce: "nonce-policy-1",
  };
}

test("creates and verifies a HUMAN_CONFIRMATION ExecutionIntent", async () => {
  const intent = await createExecutionIntent(humanInput());
  assert.equal(intent.state, "CREATED");
  assert.match(intent.intent_hash, /^sha256-[0-9a-f]{64}$/);
  assert.equal(await verifyExecutionIntentHash(intent), true);
  assert.deepEqual(validateExecutionIntent(intent), { valid: true, failures: [] });
});

test("creates a POLICY_AUTHORIZATION ExecutionIntent without confirmation", async () => {
  const intent = await createExecutionIntent(policyInput());
  assert.equal(intent.authorization_source, "POLICY_AUTHORIZATION");
  assert.equal(intent.confirmation_ref, undefined);
  assert.equal(await verifyExecutionIntentHash(intent), true);
});

test("state transitions do not change the immutable intent hash", async () => {
  const intent = await createExecutionIntent(humanInput());
  const planned = transitionExecutionIntent(intent, "PLAN_BOUND");
  const confirmed = transitionExecutionIntent(planned, "CONFIRMED");
  assert.equal(confirmed.intent_hash, intent.intent_hash);
  assert.equal(await verifyExecutionIntentHash(confirmed), true);
});

test("rejects invalid state transitions", async () => {
  const intent = await createExecutionIntent(humanInput());
  assert.equal(isExecutionIntentTransitionAllowed("CREATED", "ATTEMPTED"), false);
  assert.throws(() => transitionExecutionIntent(intent, "ATTEMPTED"), /Invalid ExecutionIntent transition/);
});

test("rejects empty intent_id", async () => {
  await assert.rejects(
    createExecutionIntent({ ...humanInput(), intent_id: "   " }),
    /intent_id is required/,
  );
});

test("rejects incomplete identity lock", async () => {
  const input = humanInput();
  input.identity_lock.store_id = "";
  await assert.rejects(
    createExecutionIntent(input),
    /store_id is required/,
  );
});

test("rejects HUMAN_CONFIRMATION without confirmation_ref", async () => {
  const input = humanInput();
  delete input.confirmation_ref;
  await assert.rejects(
    createExecutionIntent(input),
    /requires confirmation_ref/,
  );
});

test("rejects POLICY_AUTHORIZATION with confirmation_ref", async () => {
  const input = { ...policyInput(), confirmation_ref: humanInput().confirmation_ref };
  await assert.rejects(
    createExecutionIntent(input),
    /must not include confirmation_ref/,
  );
});

test("rejects expires_at that is not after created_at", async () => {
  await assert.rejects(
    createExecutionIntent({ ...humanInput(), expires_at: "2026-10-03T00:00:00.000Z" }),
    /expires_at must be after created_at/,
  );
});

test("rejects empty nonce", async () => {
  await assert.rejects(
    createExecutionIntent({ ...humanInput(), nonce: " " }),
    /nonce is required/,
  );
});

test("detects a tampered intent hash", async () => {
  const intent = await createExecutionIntent(humanInput());
  const tampered = { ...intent, intent_hash: "sha256-" + "0".repeat(64) };
  assert.equal(await verifyExecutionIntentHash(tampered), false);
});

test("canonical hash is independent of object key insertion order", async () => {
  const inputA = humanInput();
  const inputB = {
    nonce: inputA.nonce,
    expires_at: inputA.expires_at,
    created_at: inputA.created_at,
    document_generation: inputA.document_generation,
    session_generation: inputA.session_generation,
    confirmation_ref: inputA.confirmation_ref,
    policy_ref: inputA.policy_ref,
    plan_ref: inputA.plan_ref,
    identity_lock: {
      generation: inputA.identity_lock.generation,
      trigger_message_id: inputA.identity_lock.trigger_message_id,
      conversation_id: inputA.identity_lock.conversation_id,
      customer_identity: inputA.identity_lock.customer_identity,
      platform_account_id: inputA.identity_lock.platform_account_id,
      platform: inputA.identity_lock.platform,
      store_id: inputA.identity_lock.store_id,
      merchant_id: inputA.identity_lock.merchant_id,
    },
    authorization_source: inputA.authorization_source,
    intent_id: inputA.intent_id,
  };
  const a = await createExecutionIntent(inputA);
  const b = await createExecutionIntent(inputB);
  assert.equal(a.intent_hash, b.intent_hash);
});
