import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-032 clean-room baseline guards (mechanical invariants only):
// the existing platform panel baseline (empty-platform-panel / platform-surface)
// must not read embedded/cross-origin DOM, must not use raw IPC or renderer
// network, and must render without unsafe HTML injection. These are provisional
// clean-room invariants (reference-derived = NO, reference_match_status =
// NOT_ESTABLISHED, layout_stability = PROVISIONAL). Platform identifiers such as
// "PDD" are legitimate and are NOT forbidden.
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer", "components");
const EMPTY = join(R, "empty-platform-panel.ts");
const SURFACE = join(R, "platform-surface.ts");
const SHELL = join(R, "app-shell.ts");

const DOM_READ = ["querySelector", "querySelectorAll", "contentDocument", "contentWindow"];
const SAFETY = ["ipcRenderer", "fetch(", "WebSocket", "localStorage", "sessionStorage", "innerHTML", "eval(", "new Function"];

function baseName(p) {
  return p.split(/[\\/]/).pop();
}

test("platform panel baseline never reads embedded/cross-origin DOM", () => {
  for (const f of [EMPTY, SURFACE]) {
    const src = readFileSync(f, "utf-8");
    for (const t of DOM_READ) {
      assert.ok(!src.includes(t), baseName(f) + " must not use " + t);
    }
  }
});

test("platform panel baseline has no raw IPC / renderer network / unsafe rendering", () => {
  for (const f of [EMPTY, SURFACE]) {
    const src = readFileSync(f, "utf-8");
    for (const t of SAFETY) {
      assert.ok(!src.includes(t), baseName(f) + " must not use " + t);
    }
  }
});

test("app-shell still composes the platform-host region (existing structure)", () => {
  const shell = readFileSync(SHELL, "utf-8");
  assert.ok(shell.includes("renderEmptyPlatformPanel"), "must compose empty platform panel");
  assert.ok(shell.includes("platform-host"), "must keep platform-host");
});