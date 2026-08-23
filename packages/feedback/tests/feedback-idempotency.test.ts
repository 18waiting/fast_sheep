import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackIdempotency } from "../dist/index.js";

test("idempotency marks and detects duplicates", () => {
  const d = new FeedbackIdempotency(4);
  assert.equal(d.isDuplicate("r1"), false);
  d.mark("r1");
  assert.equal(d.isDuplicate("r1"), true);
  for (let i = 0; i < 20; i++) d.mark("x" + i);
  assert.ok(d.seen.size <= 4);
});
