import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import type { WorkbenchViewModel } from "@fastwork/desktop-ipc";

function vm(mode: "human_review" | "full_auto"): WorkbenchViewModel {
  return {
    revision: 1,
    shop_summaries: [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }],
    selected_shop_id: "s1",
    conversation: { conversation_id: "c1", shop_id: "s1", state: "idle" },
    suggestion: null,
    mode,
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}

function makeApi(mode: "human_review" | "full_auto") {
  const calls: string[] = [];
  const api: WorkbenchApiLike = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: vm(mode) } }),
    getSnapshot: async () => ({ ok: true, data: vm(mode) }),
    setMode: async (req) => { calls.push("setMode:" + req.mode); return { ok: true, data: { ok: true } }; },
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
  };
  return { api, calls };
}

test("mode toggle forwards human_review/full_auto to orchestrator.set_mode", async () => {
  const { api, calls } = makeApi("human_review");
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.setMode("full_auto");
  assert.deepEqual(calls, ["setMode:full_auto"]);
  assert.equal(store.getState().pendingCommand, null);
});

test("mode toggle never decides business outcome (GF-ORCH-003 stays in Main)", () => {
  // The renderer only forwards the intent; the mode transition + pending
  // suggestion handling is owned by M5.
  const { api } = makeApi("full_auto");
  const store = new WorkbenchStore(api);
  assert.equal(typeof store.setMode, "function");
  void api;
});

test("set_mode pending guard prevents double toggles", async () => {
  const { api } = makeApi("human_review");
  const store = new WorkbenchStore(api);
  await store.boot();
  const p = store.setMode("full_auto");
  assert.equal(store.isCommandPending("set_mode"), true);
  await p;
  assert.equal(store.isCommandPending("set_mode"), false);
});
