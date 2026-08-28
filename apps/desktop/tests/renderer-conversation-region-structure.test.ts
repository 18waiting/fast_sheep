import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-030/063/064 clean-room consolidation guards: the conversation region composes
// panel + Timeline (primary content) + Composer (reply surface below), each into its
// OWN sub-container so no render function can clobber a sibling surface (REPAIR #2
// root cause). No bridge/backend/auth/network dependency and safe text rendering only.
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer", "components");
const CONV = join(R, "conversation-panel.ts");
const SUGG = join(R, "suggestion-panel.ts");
const TIMELINE = join(R, "message-timeline.ts");
const COMPOSER = join(R, "composer.ts");
const REGION = join(R, "conversation-region.ts");
const SHELL = join(R, "app-shell.ts");

const BRIDGE_TOKENS = ["店铺API", "ipcRenderer", "fetch(", "WebSocket", "localStorage", "sessionStorage", "navigate(", "api_key", "credential"];

function baseName(p) {
  return p.split(/[\\/]/).pop();
}

test("conversation region keeps clean-room boundaries (no bridge/auth/network)", () => {
  for (const f of [CONV, SUGG, TIMELINE, COMPOSER, REGION]) {
    const src = readFileSync(f, "utf-8");
    for (const t of BRIDGE_TOKENS) {
      assert.ok(!src.includes(t), baseName(f) + " must not use " + t);
    }
  }
});

test("conversation region renders untrusted text safely (no innerHTML)", () => {
  for (const f of [CONV, SUGG, TIMELINE, COMPOSER, REGION]) {
    const src = readFileSync(f, "utf-8");
    assert.ok(!src.includes("innerHTML"), baseName(f) + " must not use innerHTML");
  }
});

test("conversation-region composes panel + timeline + composer into SEPARATE sub-containers (no clobber, REPAIR #2)", () => {
  const src = readFileSync(REGION, "utf-8");
  for (const token of ["conversation-panel-host", "conversation-timeline-host", "composer-host"]) {
    assert.ok(src.includes(token), "conversation-region must create " + token);
  }
  for (const fn of ["renderConversationPanel", "renderMessageTimeline", "renderComposer"]) {
    assert.ok(src.includes(fn), "conversation-region must compose " + fn);
  }
  // each surface gets its own host so a component's clear() never wipes a sibling
  assert.ok(src.indexOf("conversation-panel-host") < src.indexOf("conversation-timeline-host"), "panel host before timeline host");
  assert.ok(src.indexOf("conversation-timeline-host") < src.indexOf("composer-host"), "timeline host before composer host");
});

test("app-shell composes conversation-host + suggestion-host (existing structure kept)", () => {
  const shell = readFileSync(SHELL, "utf-8");
  assert.ok(shell.includes("renderConversationRegion"), "must compose conversation region");
  assert.ok(shell.includes("renderSuggestionPanel"), "must compose suggestion panel");
  assert.ok(shell.includes("conversation-host"), "must keep conversation-host");
  assert.ok(shell.includes("suggestion-host"), "must keep suggestion-host");
});
