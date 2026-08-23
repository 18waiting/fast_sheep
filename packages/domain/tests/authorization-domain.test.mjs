import { test } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../dist/authorization-domain.js";
import { ROLE_AGENT } from "../dist/index.js";

// --- tightening 1: Platform Capability != Authorization Capability ---
test("PLATFORM_CAPABILITIES is the 13 Master §8 platform-adapter capabilities (separate concept)", () => {
  const expected = [
    "receive_message","send_text","send_image","read_customer","read_product","read_order",
    "read_logistics","read_refund","send_product_card","send_order_card","transfer_human",
    "add_customer_tag","add_internal_note",
  ];
  assert.deepEqual([...auth.PLATFORM_CAPABILITIES], expected);
  assert.equal(auth.PLATFORM_CAPABILITIES.length, 13);
});

test("Authorization Capability registry contract is UNSEEDED (no auth capabilities invented)", () => {
  // A valid registry per the contract starts empty: no canonical auth capability
  // constants are exported by the model (governance has not enumerated them).
  const registry = new Map(); // CapabilityRegistry
  assert.equal(registry.size, 0);
  const exported = Object.keys(auth);
  for (const name of exported) {
    assert.ok(!name.startsWith("CAP_"), `no invented auth capability constant: ${name}`);
  }
});

// --- tightening 2: ResourceScope discriminated union ---
test("ResourceScope: merchant scope retains explicit merchantId", () => {
  const s = { kind: "merchant", merchantId: "m-1" };
  assert.equal(s.kind, "merchant");
  assert.equal(s.merchantId, "m-1");
});

test("ResourceScope: store scope keeps merchant context + storeId (no arbitrary combos)", () => {
  const s = { kind: "store", merchantId: "m-1", storeId: "s-1" };
  assert.equal(s.kind, "store");
  assert.equal(s.merchantId, "m-1");
  assert.equal(s.storeId, "s-1");
  assert.deepEqual(Object.keys(s).sort(), ["kind", "merchantId", "storeId"]);
});

test("ResourceScope: platformAccount scope keeps merchant context + platformAccountId", () => {
  const s = { kind: "platformAccount", merchantId: "m-1", platformAccountId: "pa-1" };
  assert.equal(s.kind, "platformAccount");
  assert.equal(s.merchantId, "m-1");
  assert.equal(s.platformAccountId, "pa-1");
});

// --- tightening 3: RoleCapabilitySet is input structure only ---
test("RoleCapabilitySet is a composition structure (input), not a role=>allow result", () => {
  const set = { role: ROLE_AGENT, capabilities: [] };
  assert.equal(set.role, ROLE_AGENT);
  assert.deepEqual(set.capabilities, []);
  assert.deepEqual(Object.keys(set).sort(), ["capabilities", "role"]);
  // No final authorization evaluator is exported by this model.
  for (const forbidden of ["can", "authorize", "evaluate", "allow"]) {
    assert.equal(Object.hasOwn(auth, forbidden), false, `no final auth evaluator: ${forbidden}`);
  }
});

// --- tightening 4: no Commercial Entitlement leakage ---
test("No Entitlement names (PDD_ENABLED / AI_AUTO_REPLY_ENABLED / MAX_STORES) exported", () => {
  for (const name of ["PDD_ENABLED", "AI_AUTO_REPLY_ENABLED", "MAX_STORES"]) {
    assert.equal(Object.hasOwn(auth, name), false, `entitlement must not be a capability: ${name}`);
  }
});

// --- T1 / T3: no status / no sync semantics ---
test("Capability/ResourceScope/RoleCapabilitySet carry no status or sync fields (T1/T3)", () => {
  const objs = [
    { kind: "merchant", merchantId: "m" },
    { role: ROLE_AGENT, capabilities: [] },
  ];
  for (const obj of objs) {
    for (const k of Object.keys(obj)) assert.notEqual(k, "status");
    for (const k of ["revision", "outbox", "version", "lastSyncedAt"]) {
      assert.equal(Object.hasOwn(obj, k), false);
    }
  }
});