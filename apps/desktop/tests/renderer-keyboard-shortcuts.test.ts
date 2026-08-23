import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSuggestionKey } from "../dist/renderer/state/view-model.js";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const vm = {
  revision: 1,
  shop_summaries: [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }],
  selected_shop_id: "s1",
  conversation: { conversation_id: "c1", shop_id: "s1", state: "suggestion_pending" },
  suggestion: { reply: "r", generation: 1, status: "pending" },
  mode: "human_review",
  countdown: null,
  worker_status: { status: "ready" },
  platform_capability: "none",
} as const;

function makeApi(overrides: Partial<WorkbenchApiLike> = {}): WorkbenchApiLike {
  return {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: vm as never } }),
    getSnapshot: async () => ({ ok: true, data: vm as never }),
    setMode: async () => ({ ok: true, data: { ok: true } }),
    manualSend: async () => ({ ok: true, data: { ok: true } }),
    noSaveSend: async () => ({ ok: true, data: { ok: true } }),
    cancel: async () => ({ ok: true, data: { ok: true } }),
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s1", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
    ...overrides,
  };
}

test("Enter/Alt+Enter map to suggestion intents only", () => {
  assert.equal(resolveSuggestionKey({ key: "Enter", altKey: false }), "manual_send");
  assert.equal(resolveSuggestionKey({ key: "Enter", altKey: true }), "no_save_send");
  assert.equal(resolveSuggestionKey({ key: "Tab", altKey: false }), null);
});

test("keyboard handler is attached to the suggestion panel, never globally", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "suggestion-panel.ts"), "utf-8");
  assert.match(src, /panel\.addEventListener\("keydown"/);
  assert.doesNotMatch(src, /document\.addEventListener\("keydown"/);
  assert.doesNotMatch(src, /window\.addEventListener\("keydown"/);
});

test("duplicate keypress UX is guarded while the same command is pending", async () => {
  const store = new WorkbenchStore(makeApi());
  await store.boot();
  const p = store.manualSend();
  assert.equal(store.isCommandPending("manual_send"), true, "second Enter should be ignored while pending");
  await p;
  assert.equal(store.isCommandPending("manual_send"), false);
});
