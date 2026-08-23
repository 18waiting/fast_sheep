import { test } from "node:test";
import assert from "node:assert/strict";
import { guardDetail } from "../dist/index.js";

test("empty candidate rejected", () => {
  assert.deepEqual(guardDetail(""), { dirty: true, reason: "empty" });
});

test("length boundary: exactly 20000 allowed, 20001 rejected", () => {
  assert.equal(guardDetail("x".repeat(20000)).dirty, false);
  assert.deepEqual(guardDetail("x".repeat(20001)), { dirty: true, reason: "length" });
});

test("html rejected", () => {
  assert.deepEqual(guardDetail("<div>垃圾</div>"), { dirty: true, reason: "html" });
});

test("tailwind class rejected", () => {
  assert.deepEqual(guardDetail('class="--tw-" content'), { dirty: true, reason: "tailwind" });
});

test("clean candidate passes", () => {
  assert.deepEqual(guardDetail("<优化后详情>"), { dirty: false });
});
