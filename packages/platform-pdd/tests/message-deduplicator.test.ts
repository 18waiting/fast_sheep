import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageDeduplicator } from "../dist/message-deduplicator.js";

test("observe records new keys and rejects duplicates", () => {
  const d = new MessageDeduplicator(10);
  assert.equal(d.observe("m1"), true);
  assert.equal(d.observe("m1"), false);
  assert.equal(d.observe("m2"), true);
  assert.equal(d.stats().size, 2);
});

test("DOM rerender duplicate never emits twice", () => {
  const d = new MessageDeduplicator(10);
  assert.equal(d.observe("mid-1"), true);
  assert.equal(d.observe("mid-1"), false, "MutationObserver rerender must be deduplicated");
  assert.equal(d.stats().size, 1);
});

test("dedup storage is bounded (no unbounded history)", () => {
  const d = new MessageDeduplicator(8);
  for (let i = 0; i < 100; i++) d.observe("m" + i);
  assert.ok(d.stats().size <= 8);
});
