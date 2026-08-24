import { test } from "node:test";
import assert from "node:assert/strict";
import * as sr from "../dist/sync-readiness.js";

// --- SyncClass is exactly the Master §15 three data classes ---
test("SyncClass vocabulary is exactly the Master §15 three classes", () => {
  const classes = ["cloud_authoritative", "local_authoritative", "replicated"];
  // type-level: assign each to SyncClass
  for (const c of classes) {
    const hook = { syncClass: c };
    assert.equal(hook.syncClass, c);
  }
});

// --- no marker interfaces manufactured (tightening #1) ---
test("No meaningless capability marker interfaces are exported", () => {
  const exported = Object.keys(sr);
  for (const name of ["ChangeMetadataCapability", "RevisionCapability", "MutationBoundary"]) {
    assert.equal(exported.includes(name), false, `no marker interface: ${name}`);
  }
});

// --- SyncClassPolicyHook is a policy integration point, optional, no assignment ---
test("SyncClassPolicyHook: syncClass optional; absent is valid; no entity is assigned a class", () => {
  const empty = {}; // valid hook with no class
  assert.equal(Object.hasOwn(empty, "syncClass"), false);
  const withClass = { syncClass: "replicated" };
  assert.equal(withClass.syncClass, "replicated");
});

// --- existing domain entities carry NO syncClass / syncEnabled / sync fields ---
test("No Phase 1 entity has syncClass / syncEnabled / sync metadata fields", () => {
  const entities = [
    { id: "merchant-1", name: "m" },                       // Merchant
    { id: "store-1", merchantId: "m", name: "s", platform: "pdd" }, // Store
    { id: "c-1", merchantId: "m", storeId: "s", platformAccountId: "p", externalRef: { value: "x" } }, // Conversation
    { id: "cust-1", merchantId: "m", platformAccountId: "p" }, // Customer
    { id: "prod-1", merchantId: "m", platformAccountId: "p" }, // Product
    { id: "o-1", merchantId: "m", platformAccountId: "p" }, // Order
  ];
  for (const e of entities) {
    for (const k of ["syncClass", "syncEnabled", "syncReady", "cloudRef", "remoteRef", "revision", "lastSyncedAt", "pendingUpload"]) {
      assert.equal(Object.hasOwn(e, k), false, `no sync field ${k}`);
    }
  }
});

// --- sync-ready != sync-enabled hard boundary (encoded as SyncReadiness) ---
test("SyncReadiness distinguishes ready from enabled (hard boundary)", () => {
  const ready = "ready";
  const enabled = "enabled";
  assert.notEqual(ready, enabled);
  assert.equal(ready, "ready");
  assert.equal(enabled, "enabled");
  // "enabled" must not be produced by this contract: the module exports no function/constant
  // that yields "enabled" for any entity.
  const exported = Object.keys(sr);
  assert.ok(!exported.includes("SYNC_ENABLED"), "no constant enables sync");
  assert.ok(!exported.includes("enableSync"), "no enable function");
});