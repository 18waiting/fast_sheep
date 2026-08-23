import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionFor, sanitizeShopId, assertSafePartition } from "../dist/main/platforms/pdd/pdd-session-partition.js";

test("two PDD shops use distinct persist partitions", () => {
  assert.notEqual(partitionFor("shop-1"), partitionFor("shop-2"));
});

test("partition pattern is persist:shop-<sanitized>", () => {
  assert.match(partitionFor("shop-a"), /^persist:shop-[A-Za-z0-9._-]+$/);
});

test("sanitization removes unsafe/path-traversal characters and secrets stay out", () => {
  assert.equal(sanitizeShopId("../../etc"), ".._.._etc"); // dots kept, slashes sanitized; no path traversal
  assert.equal(sanitizeShopId("shop 1"), "shop_1");
  assert.ok(!partitionFor("../../etc").includes("/"));
  assert.ok(!partitionFor("x;secret=1").includes(";"));
});

test("assertSafePartition rejects unsafe partition names", () => {
  assert.throws(() => assertSafePartition("persist:shop-../evil"));
  assert.throws(() => assertSafePartition("memory:"));
  assert.doesNotThrow(() => assertSafePartition("persist:shop-a1"));
});
