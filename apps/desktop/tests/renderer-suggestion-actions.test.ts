import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSuggestionKey } from "../dist/renderer/state/view-model.js";

test("Enter maps to manual_send only in suggestion context", () => {
  assert.equal(resolveSuggestionKey({ key: "Enter", altKey: false }), "manual_send");
  assert.equal(resolveSuggestionKey({ key: "Enter", altKey: true }), "no_save_send");
});

test("other keys never trigger sends", () => {
  for (const key of ["a", "ArrowDown", "Tab", "Escape", "Shift", " "]) {
    assert.equal(resolveSuggestionKey({ key, altKey: false }), null);
    assert.equal(resolveSuggestionKey({ key, altKey: true }), null);
  }
});

test("renderer suggestion actions map only to typed IPC (store adapter)", async () => {
  const { WorkbenchStore } = await import("../dist/renderer/state/workbench-store.js");
  const calls: string[] = [];
  const api = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: { revision: 1, shop_summaries: [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }], selected_shop_id: "s1", conversation: { conversation_id: "c1", shop_id: "s1", state: "suggestion_pending" }, suggestion: { reply: "r", generation: 1, status: "pending" }, mode: "human_review", countdown: null, worker_status: { status: "ready" }, platform_capability: "none" } } }),
    getSnapshot: async () => ({ ok: true, data: { revision: 2, shop_summaries: [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }], selected_shop_id: "s1", conversation: { conversation_id: "c1", shop_id: "s1", state: "suggestion_pending" }, suggestion: { reply: "r", generation: 1, status: "pending" }, mode: "human_review", countdown: null, worker_status: { status: "ready" }, platform_capability: "none" } }),
    setMode: async () => { calls.push("setMode"); return { ok: true, data: { ok: true } }; },
    manualSend: async () => { calls.push("manualSend"); return { ok: true, data: { ok: true } }; },
    noSaveSend: async () => { calls.push("noSaveSend"); return { ok: true, data: { ok: true } }; },
    cancel: async () => { calls.push("cancel"); return { ok: true, data: { ok: true } }; },
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s1", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
  } as unknown as WorkbenchApiLike;
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.manualSend();
  await store.noSaveSend();
  await store.cancel();
  assert.deepEqual(calls, ["manualSend", "noSaveSend", "cancel"]);
});
