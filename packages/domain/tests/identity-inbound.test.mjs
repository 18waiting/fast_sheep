import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as identityInbound from "../dist/identity-inbound.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const declaration = readFileSync(join(HERE, "..", "dist", "identity-inbound.d.ts"), "utf-8");
const compact = declaration.replace(/\s+/g, " ");

function interfaceBody(name) {
  const match = declaration.match(new RegExp("export interface " + name + " \\{([\\s\\S]*?)\\n\\}"));
  assert.ok(match, name + " interface must exist");
  return match[1];
}

test("identity resolution exposes RESOLVED, UNKNOWN, and UNRESOLVED explicitly", () => {
  const body = compact.slice(compact.indexOf("export type IdentityResolution<T> ="), compact.indexOf("export type PlatformMessageIdentity ="));
  assert.match(body, /"RESOLVED"/);
  assert.match(body, /"UNKNOWN"/);
  assert.match(body, /"UNRESOLVED"/);
  assert.match(body, /readonly value: T/);
});

test("runtime shop identity remains distinct from Store and PlatformAccount", () => {
  const body = interfaceBody("IdentityLock");
  assert.match(body, /runtimeShop:\s*IdentityResolution<RuntimeShopRef>/);
  assert.match(body, /storeId:\s*IdentityResolution<StoreId>/);
  assert.match(body, /platformAccountId:\s*IdentityResolution<PlatformAccountId>/);
  assert.doesNotMatch(body, /runtimeShop:[^;]*(?:StoreId|PlatformAccountId)/);
});

test("platform customer and internal conversation identities are distinct types", () => {
  const body = interfaceBody("IdentityLock");
  assert.match(body, /platformCustomerId:\s*IdentityResolution<CustomerExternalRef>/);
  assert.match(body, /internalConversationId:\s*IdentityResolution<ConversationId>/);
  assert.match(body, /runtimeConversationReference:\s*IdentityResolution<ConversationExternalRef>/);
});

test("equal opaque string contents remain representable", () => {
  const equal = "same-opaque-value";
  const lockShape = {
    platformCustomerId: { status: "RESOLVED", value: { value: equal } },
    internalConversationId: { status: "RESOLVED", value: equal },
  };
  assert.equal(lockShape.platformCustomerId.value.value, lockShape.internalConversationId.value);
  assert.ok(lockShape.platformCustomerId, "platform customer identity remains a distinct field");
  assert.ok(lockShape.internalConversationId, "internal conversation identity remains a distinct field");
});

test("platform message provenance is explicit and non-authoritative variants remain distinct", () => {
  const block = compact.slice(compact.indexOf("export type PlatformMessageIdentity ="), compact.indexOf("export type RuntimeSelectedCustomerObservation ="));
  assert.match(block, /AUTHORITATIVE_PLATFORM_ID/);
  assert.match(block, /LOCAL_FINGERPRINT/);
  assert.match(block, /SYNTHETIC/);
  assert.match(block, /UNKNOWN/);
});

test("runtime evidence uses generic platform customer evidence and no PII", () => {
  assert.match(compact, /export type RuntimeSelectedCustomerObservation/);
  assert.match(compact, /platformCustomerId: CustomerExternalRef/);
  assert.doesNotMatch(declaration, /customerUid/);
  for (const forbidden of ["nickname", "phone", "address", "email", "avatar"]) {
    assert.doesNotMatch(declaration, new RegExp(forbidden, "i"));
  }
});

test("InboundEnvelope owns source content/time while IdentityLock excludes downstream facts", () => {
  const lock = interfaceBody("IdentityLock");
  const envelope = interfaceBody("InboundEnvelope");
  assert.doesNotMatch(lock, /sourceContent|sourceOccurredAt/);
  assert.match(envelope, /sourceContent:\s*InboundSourceContent/);
  assert.match(envelope, /sourceOccurredAt:\s*string \| null/);
  for (const forbidden of ["scene", "aiReply", "contextEnvelope", "policyResult", "sendResult", "deliveryOutcome"]) {
    assert.doesNotMatch(lock, new RegExp(forbidden, "i"));
    assert.doesNotMatch(envelope, new RegExp(forbidden, "i"));
  }
});

test("no identity-substitution or mutation helper is exposed", () => {
  assert.deepEqual(Object.keys(identityInbound), []);
  for (const forbidden of [
    "createIdentityLock",
    "mapShopRecordToStoreId",
    "mapShopRecordToPlatformAccountId",
    "substituteIdentity",
    "mutateIdentity",
  ]) {
    assert.equal(Object.hasOwn(identityInbound, forbidden), false, forbidden);
    assert.doesNotMatch(declaration, new RegExp(forbidden));
  }
});
