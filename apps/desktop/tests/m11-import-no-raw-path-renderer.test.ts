import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RENDERER = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer");

test("renderer has no unrestricted filesystem access / raw path commands", () => {
  for (const name of ["legacy-import-panel.ts", "legacy-import-source-list.ts", "legacy-import-plan-view.ts", "legacy-import-conflict-view.ts", "legacy-import-progress.ts", "legacy-import-result-view.ts"]) {
    const c = readFileSync(join(RENDERER, "components", name), "utf-8");
    for (const token of ["node:fs", "readFileSync", "ipcRenderer", "process.env", "require("]) {
      assert.ok(!c.includes(token), name + " must not use " + token);
    }
  }
});
