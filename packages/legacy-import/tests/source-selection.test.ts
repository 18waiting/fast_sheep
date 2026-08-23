import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSelection, sourceTypeForPath, LegacyImportError } from "../dist/index.js";

function makeRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "fw-sel-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel);
    writeFileSync(p, content);
  }
  return root;
}

test("createSelection builds an explicit selection only from chosen files", () => {
  const root = makeRoot({ "shops.json": "[]", "Fastkey.json": "{}" });
  const sel = createSelection(root, [join(root, "shops.json"), join(root, "Fastkey.json")]);
  assert.equal(sel.items.length, 2);
  assert.ok(sel.selection_id.startsWith("sel-"));
  assert.ok(sel.items.every((i) => i.path.startsWith(root)));
});

test("sourceTypeForPath maps known legacy filenames", () => {
  assert.equal(sourceTypeForPath("shops.json"), "shops");
  assert.equal(sourceTypeForPath("Fastkey.json"), "fastkey");
  assert.equal(sourceTypeForPath("消息记录.csv"), "messages");
  assert.equal(sourceTypeForPath("B库人工确认过.csv"), "knowledge");
});

test("selection rejects files outside the root (path escape)", () => {
  const root = makeRoot({ "a.json": "{}" });
  const outside = join(tmpdir(), "outside-" + Date.now() + ".json");
  writeFileSync(outside, "{}");
  assert.throws(() => createSelection(root, [outside]), (e) => (e as LegacyImportError).code === "import.path_unsafe");
});
