import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackRetryPolicy } from "../dist/index.js";

test("retry is bounded and respects final failures", () => {
  const p = new FeedbackRetryPolicy(3);
  assert.equal(p.shouldRetry(1, "boom"), true);
  assert.equal(p.shouldRetry(3, "boom"), false);
  assert.equal(p.shouldRetry(1, "FAILED_FINAL"), false);
});
