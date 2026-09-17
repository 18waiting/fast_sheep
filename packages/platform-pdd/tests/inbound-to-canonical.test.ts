import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPddInboundToCanonical, normalizePddInboundForCanonical } from "../dist/index.js";

function resolution(value: unknown) {
  return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value };
}

function identity(overrides: Record<string, unknown> = {}) {
  return {
    runtimeShop: resolution({ value: "shop-1" }),
    scope: {
      merchantId: resolution("merchant-1"),
      storeId: resolution("store-1"),
      platformAccountId: resolution("account-1"),
    },
    runtimeConversationReference: resolution({ value: "runtime-conversation-1" }),
    association: {
      platformCustomerId: "6318084722818",
      platformMessageId: "987654321098765432109876543210",
      internalConversationId: { status: "UNRESOLVED" },
      localMessageId: { status: "UNKNOWN" },
    },
    ...overrides,
  } as never;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    content: "  请问什么时候发货？\n",
    from: { role: "user", uid: "6318084722818" },
    to: { role: "mall_cs", uid: "opaque-cs" },
    msg_id: "987654321098765432109876543210",
    ...overrides,
  };
}

function normalize(input: Record<string, unknown>) {
  const result = normalizePddInboundForCanonical(input);
  assert.equal(result.status, "ACCEPTED");
  if (result.status !== "ACCEPTED") throw new Error("unreachable");
  return result.value;
}

test("complete trusted input maps to a fresh canonical envelope", () => {
  const result = mapPddInboundToCanonical({
    normalized: normalize(payload()),
    identity: identity(),
    runtime: { sessionId: "pdd-session-shop-1", documentGeneration: 7 },
    sourceOccurredAt: "2026-09-17T12:00:00Z",
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.identityLock.platform, "pdd");
  assert.deepEqual(result.envelope.identityLock.runtimeShop, { status: "RESOLVED", value: { value: "shop-1" } });
  assert.deepEqual(result.envelope.identityLock.merchantId, { status: "RESOLVED", value: "merchant-1" });
  assert.deepEqual(result.envelope.identityLock.storeId, { status: "RESOLVED", value: "store-1" });
  assert.deepEqual(result.envelope.identityLock.platformAccountId, { status: "RESOLVED", value: "account-1" });
  assert.deepEqual(result.envelope.identityLock.platformCustomerId, {
    status: "RESOLVED",
    value: { value: "6318084722818" },
  });
  assert.deepEqual(result.envelope.identityLock.triggerMessage.platformMessageIdentity, {
    provenance: "AUTHORITATIVE_PLATFORM_ID",
    value: "987654321098765432109876543210",
  });
  assert.equal(result.envelope.sourceContent.text, "  请问什么时候发货？\n");
  assert.equal(result.envelope.sourceOccurredAt, "2026-09-17T12:00:00Z");
  assert.deepEqual(result.envelope.identityLock.runtimeEvidence, {
    sessionId: "pdd-session-shop-1",
    documentGeneration: 7,
  });
});

test("missing customerUid and msg_id remain explicit UNKNOWN", () => {
  const normalized = normalize({
    content: "hello",
    from: { role: "user" },
    to: { role: "mall_cs" },
  });
  assert.deepEqual(normalized.diagnostics, ["CUSTOMER_UID_MISSING", "PLATFORM_MESSAGE_ID_MISSING"]);
  const result = mapPddInboundToCanonical({
    normalized,
    identity: identity({ association: undefined }),
    runtime: { sessionId: "session-1", documentGeneration: 1 },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.deepEqual(result.envelope.identityLock.platformCustomerId, { status: "UNKNOWN" });
  assert.deepEqual(result.envelope.identityLock.triggerMessage.platformMessageIdentity, { provenance: "UNKNOWN" });
  assert.deepEqual(result.envelope.identityLock.internalConversationId, { status: "UNKNOWN" });
  assert.deepEqual(result.envelope.identityLock.triggerMessage.localMessageId, { status: "UNKNOWN" });
  assert.equal(result.envelope.sourceContent.text, "hello");
});

test("present but invalid identity fields are rejected", () => {
  assert.deepEqual(normalizePddInboundForCanonical(payload({ from: { role: "user", uid: "buyer-1" } })), {
    status: "REJECTED",
    reason: "customer_uid_invalid",
    diagnostics: [],
  });
  assert.deepEqual(normalizePddInboundForCanonical(payload({ msg_id: "   " })), {
    status: "REJECTED",
    reason: "platform_message_id_invalid",
    diagnostics: [],
  });
});

test("trusted opaque values are preserved without lexical guessing", () => {
  const result = mapPddInboundToCanonical({
    normalized: normalize(payload({ from: { role: "user", uid: "0" }, msg_id: "unknown" })),
    identity: identity({
      association: {
        platformCustomerId: "0",
        platformMessageId: "unknown",
        internalConversationId: resolution("unknown"),
        localMessageId: resolution("placeholder"),
      },
    }),
    runtime: { sessionId: "session-1", documentGeneration: 1 },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.deepEqual(result.envelope.identityLock.platformCustomerId, { status: "RESOLVED", value: { value: "0" } });
  assert.deepEqual(result.envelope.identityLock.triggerMessage.platformMessageIdentity, {
    provenance: "AUTHORITATIVE_PLATFORM_ID",
    value: "unknown",
  });
  assert.deepEqual(result.envelope.identityLock.internalConversationId, { status: "RESOLVED", value: "unknown" });
  assert.deepEqual(result.envelope.identityLock.triggerMessage.localMessageId, { status: "RESOLVED", value: "placeholder" });
});

test("selected customer observation remains evidence and does not fill message sender identity", () => {
  const result = mapPddInboundToCanonical({
    normalized: normalize({ content: "hello", from: { role: "user" }, to: { role: "mall_cs" }, msg_id: "m1" }),
    identity: identity({
      association: undefined,
      selectedCustomerObservation: { status: "SELECTED", platformCustomerId: { value: "selected-buyer" } },
    }),
    runtime: { sessionId: "session-1", documentGeneration: 2 },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.deepEqual(result.envelope.identityLock.platformCustomerId, { status: "UNKNOWN" });
  assert.deepEqual(result.envelope.identityLock.runtimeEvidence?.selectedCustomerObservation, {
    status: "SELECTED",
    platformCustomerId: { value: "selected-buyer" },
  });
});

test("source content preserves whitespace and long text", () => {
  const text = " " + "x".repeat(5000) + "\n";
  const result = mapPddInboundToCanonical({
    normalized: normalize(payload({ content: text })),
    identity: identity(),
    runtime: { sessionId: "session-1", documentGeneration: 1 },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.sourceContent.text, text);
});

test("mapped envelope is an immutable identity snapshot", () => {
  const mutableIdentity = identity();
  const result = mapPddInboundToCanonical({
    normalized: normalize(payload()),
    identity: mutableIdentity,
    runtime: { sessionId: "session-1", documentGeneration: 1 },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  const before = JSON.stringify(result.envelope);
  (mutableIdentity as { scope: unknown }).scope = { merchantId: { status: "UNKNOWN" } };
  assert.equal(JSON.stringify(result.envelope), before);
  assert.throws(() => {
    (result.envelope.identityLock as { runtimeShop: unknown }).runtimeShop = { status: "UNKNOWN" };
  }, TypeError);
});
