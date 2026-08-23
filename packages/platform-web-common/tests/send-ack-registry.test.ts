import { test } from "node:test";
import assert from "node:assert/strict";
import { SendAckRegistry } from "../dist/index.js";
test("send-ack registry excludes automated echo and expires at the inclusive boundary", () => {
  const r = new SendAckRegistry(8, 60_000);
  r.record("mid-1", 1000);
  assert.equal(r.containsWithin("mid-1", 1000), true);
  assert.equal(r.containsWithin("mid-1", 61_000), true); // inclusive boundary
  assert.equal(r.containsWithin("mid-1", 61_001), false); // expired
});
