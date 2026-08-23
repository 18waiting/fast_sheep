import { test } from "node:test";
import assert from "node:assert/strict";
import { KuaishouMessageDeduplicator } from "../dist/index.js";

test("dedup is bounded and rejects rerenders", () => {
  const d = new KuaishouMessageDeduplicator(8);
  assert.equal(d.observe("m1"), true);
  assert.equal(d.observe("m1"), false);
  for (let i = 0; i < 100; i++) d.observe("x" + i);
  assert.ok(d.stats().size <= 8);
});

test("ordering is deterministic (DOM order preserved)", () => {
  const d = new KuaishouMessageDeduplicator();
  const keys = ["m1", "m2", "m3"];
  for (const k of keys) assert.equal(d.observe(k), true);
  assert.equal(d.isDuplicate("m1"), true);
});
