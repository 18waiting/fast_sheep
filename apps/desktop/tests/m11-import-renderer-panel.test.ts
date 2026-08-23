import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_LEGACY_IMPORT_VIEW_MODEL } from "../dist/renderer/components/legacy-import-types.js";

const RENDERER = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components");

test("legacy import components are projection/control only", () => {
  for (const name of ["legacy-import-panel.ts", "legacy-import-source-list.ts", "legacy-import-plan-view.ts", "legacy-import-conflict-view.ts", "legacy-import-progress.ts", "legacy-import-result-view.ts"]) {
    const c = readFileSync(join(RENDERER, name), "utf-8");
    for (const token of ["innerHTML", "legacy_import.select", "legacy_import.apply", "ipcRenderer"]) {
      assert.ok(!c.includes(token), name + " must not use " + token);
    }
  }
});

test("empty view model is safe", () => {
  assert.equal(EMPTY_LEGACY_IMPORT_VIEW_MODEL.selection_token, null);
  assert.equal(EMPTY_LEGACY_IMPORT_VIEW_MODEL.item_count, 0);
});
