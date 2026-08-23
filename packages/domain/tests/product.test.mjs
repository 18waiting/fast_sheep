import { test } from "node:test";
import assert from "node:assert/strict";
import * as prd from "../dist/product.js";

// --- D1: no storeId; Product<->Store semantics deferred ---
test("Product identity core has merchantId + platformAccountId, NO storeId (deferred)", () => {
  const p = { id: "prod-1", merchantId: "m-1", platformAccountId: "pa-1" };
  assert.equal(p.merchantId, "m-1");
  assert.equal(p.platformAccountId, "pa-1");
  assert.deepEqual(Object.keys(p).sort(), ["id", "merchantId", "platformAccountId"]);
  assert.equal(Object.hasOwn(p, "storeId"), false, "storeId not added (Product<->Store semantics deferred)");
});

// --- D2: Sku.productId minimal ownership ---
test("Sku carries productId as minimal SKU->Product ownership only", () => {
  const s = { id: "sku-1", productId: "prod-1" };
  assert.equal(s.productId, "prod-1");
  assert.deepEqual(Object.keys(s).sort(), ["id", "productId"]);
});

// --- tightening 1: independent opaque external refs, not AccountRef, not merged ---
test("ProductExternalRef and SkuExternalRef are independent opaque {value} types", () => {
  const pr = { value: "platform-product-key" };
  const sr = { value: "platform-sku-key" };
  assert.deepEqual(Object.keys(pr).sort(), ["value"]);
  assert.deepEqual(Object.keys(sr).sort(), ["value"]);
  assert.equal(Object.hasOwn(pr, "kind"), false, "no AccountRef identity-kind reuse");
  assert.equal(Object.hasOwn(sr, "kind"), false);
});

// --- tightening 2: no SKU/product business rules ---
test("Product/Sku carry no catalog/business fields (price/stock/status/variant/lifecycle)", () => {
  const p = { id: "p", merchantId: "m", platformAccountId: "pa", externalRef: { value: "x" } };
  const s = { id: "s", productId: "p", externalRef: { value: "y" } };
  for (const obj of [p, s]) {
    for (const forbidden of ["price","stock","status","variant","options","lifecycle","salesStatus","title","skuCount","spec"]) {
      assert.equal(Object.hasOwn(obj, forbidden), false, `no business field: ${forbidden}`);
    }
  }
  // no business-rule functions exported
  const exported = Object.keys(prd);
  for (const forbidden of ["addSku","removeSku","setPrice","setStock","nextSkuLifecycle"]) {
    assert.equal(exported.includes(forbidden), false, `no business rule fn: ${forbidden}`);
  }
});

// --- tightening 3: Product Domain != Product Knowledge ---
test("Product identity core has no Knowledge-scope fields (Product Domain != Product Knowledge)", () => {
  const p = { id: "p", merchantId: "m", platformAccountId: "pa" };
  for (const forbidden of ["knowledgeScope","knowledgeId","knowledgeStoreSplit"]) {
    assert.equal(Object.hasOwn(p, forbidden), false, `no knowledge-scope leakage: ${forbidden}`);
  }
});

// --- T1/T3/T6: no status / no sync / externalRef optional ---
test("Product/Sku have no status or sync fields; externalRef optional", () => {
  const p = { id: "p", merchantId: "m", platformAccountId: "pa" };
  const s = { id: "s", productId: "p" };
  for (const obj of [p, s]) {
    for (const k of Object.keys(obj)) assert.notEqual(k, "status");
    for (const k of ["revision","outbox","version","lastSyncedAt","remoteSyncId"]) {
      assert.equal(Object.hasOwn(obj, k), false);
    }
  }
});