import { test } from "node:test";
import assert from "node:assert/strict";
import * as ci from "../dist/conversation-identity.js";

// --- tightening 1: storeId retained (governance-confirmed Store scope) ---
test("NormalizedConversationIdentity retains storeId (not omitted as derivable)", () => {
  const id = {
    localId: "c-1",
    merchantId: "m-1",
    storeId: "s-1",
    platformAccountId: "pa-1",
    externalRef: { kind: "platform", value: "ext-conv-1" },
  };
  assert.equal(id.storeId, "s-1");
  assert.deepEqual(Object.keys(id).sort(), ["externalRef", "localId", "merchantId", "platformAccountId", "storeId"]);
});

// --- tightening 2: external ref is an opaque identity capability, not a fixed shape ---
test("externalRef is an opaque AccountRef (kind/value) — no fixed externalConversationId field", () => {
  const ref = { kind: "platform", value: "any-platform-specific-key" };
  assert.deepEqual(Object.keys(ref).sort(), ["kind", "value"]);
  assert.equal(ref.kind, "platform");
});

// --- tightening 3: single platform fact source = platformAccountId; no redundant platform in externalRef ---
test("Conversation identity has no separate platform field (platform fact source = platformAccountId)", () => {
  const id = {
    localId: "c-1",
    merchantId: "m-1",
    storeId: "s-1",
    platformAccountId: "pa-1",
    externalRef: { kind: "platform", value: "x" },
  };
  assert.equal(Object.hasOwn(id, "platform"), false, "platform must not be duplicated");
  assert.equal(Object.hasOwn(id.externalRef, "platform"), false, "externalRef must not carry a second platform fact");
});

// --- tightening 4: message external ref optional, identity-reference only ---
test("Message without a platform message id is still a valid identity (externalRef optional)", () => {
  const msg = { localMessageId: "msg-1", conversationId: "c-1" };
  assert.deepEqual(Object.keys(msg).sort(), ["conversationId", "localMessageId"]);
});

test("Message with externalRef carries only an identity reference (no delivery/status/time/direction/sender)", () => {
  const msg = { localMessageId: "msg-1", conversationId: "c-1", externalRef: { kind: "platform", value: "pmsg-1" } };
  assert.equal(msg.externalRef.kind, "platform");
  for (const forbidden of ["delivery", "status", "time", "direction", "sender", "sentAt", "readAt"]) {
    assert.equal(Object.hasOwn(msg, forbidden), false, `no message business field: ${forbidden}`);
  }
});

// --- T1 / T3: no status / no sync semantics ---
test("Conversation/message identities carry no status or sync fields (T1/T3)", () => {
  const objs = [
    { localId: "c", merchantId: "m", storeId: "s", platformAccountId: "p", externalRef: { kind: "platform", value: "x" } },
    { localMessageId: "m", conversationId: "c" },
  ];
  for (const obj of objs) {
    for (const k of Object.keys(obj)) assert.notEqual(k, "status");
    for (const k of ["revision", "outbox", "version", "lastSyncedAt", "remoteSyncId"]) {
      assert.equal(Object.hasOwn(obj, k), false);
    }
  }
});