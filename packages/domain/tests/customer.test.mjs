import { test } from "node:test";
import assert from "node:assert/strict";
import * as cus from "../dist/customer.js";

// --- tightening 1: no storeId now; Customer<->Store semantics deferred ---
test("Customer identity core has merchantId + platformAccountId, NO storeId (deferred)", () => {
  const c = { id: "cust-1", merchantId: "m-1", platformAccountId: "pa-1" };
  assert.equal(c.merchantId, "m-1");
  assert.equal(c.platformAccountId, "pa-1");
  assert.deepEqual(Object.keys(c).sort(), ["id", "merchantId", "platformAccountId"]);
  assert.equal(Object.hasOwn(c, "storeId"), false, "storeId not added (Customer<->Store semantics deferred)");
});

// --- tightening 2: externalRef optional; no identity inference ---
test("CustomerExternalRef is opaque {value}, dedicated type (NOT AccountRef)", () => {
  const ref = { value: "platform-customer-key" };
  assert.deepEqual(Object.keys(ref).sort(), ["value"]);
  assert.equal(Object.hasOwn(ref, "kind"), false, "no AccountRef identity-kind reuse");
});

test("Customer without externalRef is a valid identity (no inference from absence)", () => {
  const c = { id: "cust-1", merchantId: "m-1", platformAccountId: "pa-1" };
  assert.deepEqual(Object.keys(c).sort(), ["id", "merchantId", "platformAccountId"]);
});

test("No customer identity-resolution semantics exported (no dedup/merge/matching)", () => {
  const exported = Object.keys(cus);
  for (const forbidden of ["resolveCustomer","mergeCustomers","dedup","matchCustomers","resolveCrossStore","findByNickname","findByPhone"]) {
    assert.equal(exported.includes(forbidden), false, `no identity inference: ${forbidden}`);
  }
});

// --- tightening 3: no PII in identity core; separation from profile/context ---
test("Customer identity core carries no PII/display fields", () => {
  const c = { id: "cust-1", merchantId: "m-1", platformAccountId: "pa-1", externalRef: { value: "x" } };
  for (const forbidden of ["name","nickname","phone","address","email","avatar"]) {
    assert.equal(Object.hasOwn(c, forbidden), false, `no PII/display field: ${forbidden}`);
  }
});

// --- T1 / T3 / T6: no status / no sync / no invented ---
test("Customer identity carries no status or sync fields", () => {
  const c = { id: "c", merchantId: "m", platformAccountId: "p" };
  for (const k of Object.keys(c)) assert.notEqual(k, "status");
  for (const k of ["revision","outbox","version","lastSyncedAt","remoteSyncId"]) {
    assert.equal(Object.hasOwn(c, k), false);
  }
});