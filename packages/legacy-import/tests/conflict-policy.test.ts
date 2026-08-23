import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFLICT_POLICY, resolveConflict, isConflictPolicy } from "../dist/index.js";

test("default policy is PRESERVE_EXISTING", () => {
  assert.equal(DEFAULT_CONFLICT_POLICY, "PRESERVE_EXISTING");
});

test("PRESERVE_EXISTING skips existing, inserts missing", () => {
  assert.equal(resolveConflict({ id: 1 }, {}, "PRESERVE_EXISTING").action, "skip");
  assert.equal(resolveConflict(undefined, {}, "PRESERVE_EXISTING").action, "insert");
});

test("REPLACE_SELECTED replaces; MERGE_SAFE_FIELDS merges", () => {
  assert.equal(resolveConflict({}, {}, "REPLACE_SELECTED").action, "replace");
  assert.equal(resolveConflict({ a: 1 }, { b: 2 }, "MERGE_SAFE_FIELDS").action, "merge");
});

test("isConflictPolicy validates the enum", () => {
  assert.ok(isConflictPolicy("PRESERVE_EXISTING"));
  assert.ok(!isConflictPolicy("OVERWRITE"));
});
