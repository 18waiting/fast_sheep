import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-030 clean-room consolidation guards: the conversation region stays the
// existing clean-room conversation-panel + suggestion-panel composition (SHEEP-030
// made NO product code change; reference conversation layout evidence is
// UNKNOWN/NOT_EVIDENCED in the authorized 5-bundle scope), with no
// bridge/backend/auth/network dependency and safe text rendering only.
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer", "components");
const CONV = join(R, "conversation-panel.ts");
const SUGG = join(R, "suggestion-panel.ts");
const SHELL = join(R, "app-shell.ts");

const BRIDGE_TOKENS = ["店铺API", "ipcRenderer", "fetch(", "WebSocket", "localStorage", "sessionStorage", "navigate(", "api_key", "credential"];

function baseName(p) {
  return p.split(/[\\/]/).pop();
}

test("conversation region keeps clean-room boundaries (no bridge/auth/network)", () => {
  for (const f of [CONV, SUGG]) {
    const src = readFileSync(f, "utf-8");
    for (const t of BRIDGE_TOKENS) {
      assert.ok(!src.includes(t), baseName(f) + " must not use " + t);
    }
  }
});

test("conversation region renders untrusted text safely (no innerHTML)", () => {
  for (const f of [CONV, SUGG]) {
    const src = readFileSync(f, "utf-8");
    assert.ok(!src.includes("innerHTML"), baseName(f) + " must not use innerHTML");
  }
});

test("app-shell composes conversation-host + suggestion-host (existing structure unchanged)", () => {
  const shell = readFileSync(SHELL, "utf-8");
  assert.ok(shell.includes("renderConversationPanel"), "must compose conversation panel");
  assert.ok(shell.includes("renderSuggestionPanel"), "must compose suggestion panel");
  assert.ok(shell.includes("conversation-host"), "must keep conversation-host");
  assert.ok(shell.includes("suggestion-host"), "must keep suggestion-host");
});