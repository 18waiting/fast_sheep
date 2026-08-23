import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInsideRoot, rejectTraversal, isDevicePath, LegacyImportError } from "../dist/index.js";

test("assertInsideRoot accepts nested paths and rejects escapes", () => {
  assert.equal(assertInsideRoot("C:/root", "C:/root/sub/a.json"), "C:\\root\\sub\\a.json");
  assert.throws(() => assertInsideRoot("C:/root", "C:/root/../outside.json"), (e) => (e as LegacyImportError).code === "import.path_unsafe");
});

test("rejectTraversal blocks .. tokens", () => {
  assert.throws(() => rejectTraversal("a/../../etc/passwd"), (e) => (e as LegacyImportError).code === "import.path_unsafe");
  assert.equal(rejectTraversal("a/b/c.txt"), "a\\b\\c.txt");
});

test("isDevicePath flags drive-absolute and UNC paths", () => {
  assert.ok(isDevicePath("C:/x"));
  assert.ok(isDevicePath("\\\\server\\share"));
});
