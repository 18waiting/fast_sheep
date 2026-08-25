import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-031 structural guards: the AI Panel is a clean-room three-region layout
// component (feature-list area, chat area, welcome/preset-questions area) with no
// messaging/send/streaming/model integration, no preset-card API/interaction, no
// feature-list content, no authorization/tool-domain semantics, and it is NOT mounted.
// Tests assert evidence-backed regions + negative boundaries only; the DOM hierarchy
// (ai-welcome inside ai-chat) is a provisional clean-room decision, not reference truth.
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer", "components");
const SRC = join(R, "ai-panel.ts");
const SHELL = join(R, "app-shell.ts");
const DIST = join(HERE, "..", "dist", "renderer", "components", "ai-panel.js");

const REGIONS = ["ai-panel", "ai-tools", "ai-chat", "ai-welcome"];
const BRIDGE_TOKENS = ["店铺API", "ipcRenderer", "fetch(", "WebSocket", "localStorage", "sessionStorage", "navigate(", "api_key", "credential", "token", "session", "cookie"];
const MESSAGING_TOKENS = ["onSend", "sendMessage", "stream", "composer", "presetCard", "onPresetClick", "管家API", "onClick", "addEventListener", "button(", "input(", "textarea"];
const DOMAIN_TOKENS = ["toolRegistry", "toolId", "capability", "entitlement", "permission", "authorize", "allow"];

test("ai panel establishes the three evidence-backed regions", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const r of REGIONS) {
    assert.ok(src.includes(r), "ai-panel.ts must create " + r);
  }
});

test("ai panel has no messaging/send/streaming/model integration", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of MESSAGING_TOKENS) {
    assert.ok(!src.includes(t), "ai-panel.ts must not introduce " + t);
  }
});

test("ai panel keeps clean-room boundaries (no bridge/auth/network)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of BRIDGE_TOKENS) {
    assert.ok(!src.includes(t), "ai-panel.ts must not use " + t);
  }
});

test("ai-tools carries no authorization/tool-domain semantics", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of DOMAIN_TOKENS) {
    assert.ok(!src.includes(t), "ai-panel.ts must not introduce " + t);
  }
});

test("ai panel adds no fake content (preset cards / feature list items)", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.ok(!src.includes("innerHTML"), "ai-panel.ts must not use innerHTML");
  assert.ok(!src.includes("textContent"), "ai-panel.ts must not render any content text");
});

test("ai panel is NOT mounted into the workbench (placement deferred)", () => {
  const shell = readFileSync(SHELL, "utf-8");
  assert.ok(!shell.includes("renderAiPanel"), "app-shell must not mount the AI panel yet");
  assert.ok(!shell.includes("ai-panel"), "app-shell must not reference ai-panel yet");
});

test("built ai-panel.js mirrors the same clean-room boundaries", () => {
  const js = readFileSync(DIST, "utf-8");
  for (const r of REGIONS) {
    assert.ok(js.includes(r), "dist ai-panel.js must create " + r);
  }
  for (const t of [...MESSAGING_TOKENS, ...BRIDGE_TOKENS, ...DOMAIN_TOKENS]) {
    assert.ok(!js.includes(t), "dist ai-panel.js must not use " + t);
  }
});