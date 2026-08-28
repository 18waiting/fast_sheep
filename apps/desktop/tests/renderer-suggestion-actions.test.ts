import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";

// SHEEP-064 REPAIR (I-30): the Composer is the SINGLE agent reply submission surface.
// The AI suggestion panel provides only explicit apply -> Composer draft (DP-106) and
// AI generation cancel; no legacy 手动发送 / 不保存发送 agent-send path is reachable.

function vm() {
  return {
    revision: 1,
    shop_summaries: [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }],
    selected_shop_id: "s1",
    conversation: { conversation_id: "c1", shop_id: "s1", state: "suggestion_pending" },
    suggestion: { reply: "AI 建议内容", generation: 1, status: "pending" },
    mode: "human_review",
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}

test("I-30: suggestion panel explicit apply routes ONLY to the composer draft (no legacy send)", async () => {
  const calls: string[] = [];
  const api = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: vm() } }),
    getSnapshot: async () => ({ ok: true, data: vm() }),
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
  store.activateConversation("c1");
  store.applySuggestion();
  assert.equal(store.getState().composerDrafts["c1"], "AI 建议内容", "apply fills the composer draft");
  assert.deepEqual(calls, [], "apply must NOT call any legacy send / cancel IPC");
  // generation cancel is a distinct action (cancels AI generation, not a send)
  await store.cancel();
  assert.deepEqual(calls, ["cancel"], "generation cancel is separate from any send");
});
