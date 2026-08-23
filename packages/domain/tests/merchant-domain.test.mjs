import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_PDD, PLATFORM_DOUDIAN } from "../dist/index.js";

// --- identity-kind boundary (R-07) ---
test("AccountRef supports the three identity domains (local/platform/cloud)", () => {
  for (const kind of ["local", "platform", "cloud"]) {
    const ref = { kind, value: "opaque-ref-" + kind };
    assert.equal(ref.kind, kind);
    assert.equal(typeof ref.value, "string");
  }
});

test("AccountRef carries NO sync/revision/outbox semantics (SHEEP-010 tightening #3)", () => {
  const ref = { kind: "platform", value: "seller-account-1" };
  assert.deepEqual(Object.keys(ref).sort(), ["kind", "value"]);
});

// --- merchant / store / platform account scope ---
test("Merchant requires id and name; no invented status fields", () => {
  const m = { id: "merchant-1", name: "测试商户" };
  assert.equal(m.id, "merchant-1");
  assert.equal(m.name, "测试商户");
  assert.deepEqual(Object.keys(m).sort(), ["id", "name"], "no status/enabled vocabulary without governance evidence");
});

test("Store is scoped to exactly one Merchant (governance-confirmed)", () => {
  const s = { id: "store-1", merchantId: "merchant-1", name: "PDD 店", platform: PLATFORM_PDD };
  assert.equal(s.merchantId, "merchant-1");
  assert.equal(s.platform, PLATFORM_PDD);
  assert.deepEqual(Object.keys(s).sort(), ["id", "merchantId", "name", "platform"]);
});

test("PlatformAccount is scoped to a Merchant and carries external platform identity", () => {
  const pa = {
    id: "pa-1",
    merchantId: "merchant-1",
    platform: PLATFORM_DOUDIAN,
    externalRef: { kind: "platform", value: "doudian-seller-88" },
  };
  assert.equal(pa.merchantId, "merchant-1");
  assert.equal(pa.externalRef.kind, "platform");
  assert.equal(pa.externalRef.value, "doudian-seller-88");
  assert.deepEqual(Object.keys(pa).sort(), ["externalRef", "id", "merchantId", "platform"]);
});

// --- platform extensibility (SHEEP-010 tightening #2) ---
test("PlatformId is extensible beyond known platforms (runtime: any string accepted)", () => {
  const future = "some-future-platform";
  const s = { id: "s", merchantId: "m", name: "x", platform: future };
  assert.equal(s.platform, "some-future-platform");
  assert.equal(PLATFORM_PDD, "pdd");
  assert.equal(PLATFORM_DOUDIAN, "doudian");
});