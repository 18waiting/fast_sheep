import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageDeduplicator } from "../dist/index.js";
test("dedup is bounded and rejects rerender duplicates", () => {
  const d = new MessageDeduplicator(8);
  assert.equal(d.observe("m1"), true);
  assert.equal(d.observe("m1"), false);
  for (let i = 0; i < 100; i++) d.observe("x" + i);
  assert.ok(d.stats().size <= 8);
});
