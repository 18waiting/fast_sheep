import { test } from "node:test";
import assert from "node:assert/strict";
import { effectForIntent, isNoSave } from "../dist/index.js";

test("intent effects match GF-FB mappings", () => {
  assert.equal(effectForIntent({ class: "AUTO", trust: "AUTO" }).knowledge_trust, "AUTO");
  assert.equal(effectForIntent({ class: "MANUAL", trust: "HUMAN_CONFIRMED" }).knowledge_trust, "HUMAN_CONFIRMED");
  assert.equal(effectForIntent({ class: "NO_SAVE", trust: "" }).knowledge_op, "none");
  assert.equal(effectForIntent({ class: "CORRECTION", trust: "" }).index_refresh, "incremental");
  assert.equal(effectForIntent({ class: "RESTORE", trust: "" }).index_refresh, "deferred");
});

test("isNoSave is exact", () => {
  assert.equal(isNoSave({ class: "NO_SAVE", trust: "" }), true);
  assert.equal(isNoSave({ class: "AUTO", trust: "AUTO" }), false);
});
