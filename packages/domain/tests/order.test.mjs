import { test } from "node:test";
import assert from "node:assert/strict";
import * as ord from "../dist/order.js";

// --- D1: no storeId; Order<->Store deferred ---
test("Order identity core has merchantId + platformAccountId, NO storeId (deferred)", () => {
  const o = { id: "order-1", merchantId: "m-1", platformAccountId: "pa-1" };
  assert.deepEqual(Object.keys(o).sort(), ["id", "merchantId", "platformAccountId"]);
  assert.equal(Object.hasOwn(o, "storeId"), false, "storeId not added (Order<->Store semantics deferred)");
});

// --- D2: Logistics.orderId minimal ownership; no cardinality ---
test("Logistics carries orderId as minimal ownership; no cardinality/lifecycle fields", () => {
  const l = { id: "lg-1", orderId: "order-1" };
  assert.equal(l.orderId, "order-1");
  assert.deepEqual(Object.keys(l).sort(), ["id", "orderId"]);
  for (const forbidden of ["count", "max", "min", "sequence", "lifecycle"]) {
    assert.equal(Object.hasOwn(l, forbidden), false, `no cardinality/lifecycle: ${forbidden}`);
  }
});

// --- tightening 1: Order is single ownership fact source; Logistics repeats no scope ---
test("Logistics does NOT repeat merchantId/platformAccountId (single fact source = Order)", () => {
  const l = { id: "lg-1", orderId: "order-1" };
  for (const forbidden of ["merchantId", "platformAccountId", "storeId"]) {
    assert.equal(Object.hasOwn(l, forbidden), false, `no duplicated ownership fact: ${forbidden}`);
  }
});

// --- tightening 2: Order identity not bound to order business structure ---
test("Order has no customer/product/sku/line-item/amount/payment/refund fields", () => {
  const o = { id: "o", merchantId: "m", platformAccountId: "pa", externalRef: { value: "x" } };
  for (const forbidden of ["customerId","productId","skuId","lineItems","amount","payment","refund","currency","total"]) {
    assert.equal(Object.hasOwn(o, forbidden), false, `no order business structure: ${forbidden}`);
  }
});

// --- tightening 3: LogisticsExternalRef opaque, not tracking number ---
test("LogisticsExternalRef is opaque {value}; no carrier/trackingNumber/status/events", () => {
  const ref = { value: "any-logistics-ref" };
  assert.deepEqual(Object.keys(ref).sort(), ["value"]);
  assert.equal(Object.hasOwn(ref, "kind"), false, "no AccountRef reuse");
  const l = { id: "lg", orderId: "o", externalRef: { value: "x" } };
  for (const forbidden of ["carrier","trackingNumber","trackingNo","status","events","shipment"]) {
    assert.equal(Object.hasOwn(l, forbidden), false, `no logistics business field: ${forbidden}`);
  }
});

// --- tightening 4: no Refund Domain ---
test("No Refund/after-sales domain is introduced (read_refund != Refund Domain)", () => {
  const exported = Object.keys(ord);
  for (const forbidden of ["Refund", "RefundId", "refundId", "AfterSales"]) {
    assert.equal(exported.includes(forbidden), false, `no refund domain: ${forbidden}`);
  }
});

// --- T1/T3/T6: no status / no sync / externalRef optional ---
test("Order/Logistics have no status or sync fields; externalRef optional", () => {
  const o = { id: "o", merchantId: "m", platformAccountId: "pa" };
  const l = { id: "lg", orderId: "o" };
  for (const obj of [o, l]) {
    for (const k of Object.keys(obj)) assert.notEqual(k, "status");
    for (const k of ["revision","outbox","version","lastSyncedAt","remoteSyncId"]) {
      assert.equal(Object.hasOwn(obj, k), false);
    }
  }
});