import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import type { WorkbenchViewModel } from "@fastwork/desktop-ipc";

function vmFor(shopId: string, revision: number): WorkbenchViewModel {
  return {
    revision,
    shop_summaries: [
      { shop_id: "s1", name: "店铺1", type: "pdd", enabled: true },
      { shop_id: "s2", name: "店铺2", type: "doudian", enabled: true },
    ],
    selected_shop_id: shopId,
    conversation: { conversation_id: "c-" + shopId, shop_id: shopId, state: "idle" },
    suggestion: null,
    mode: "human_review",
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}

function makeApi() {
  const calls: string[] = [];
  const api: WorkbenchApiLike = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: vmFor("s1", 1) } }),
    getSnapshot: async (req) => { calls.push("snapshot:" + (req?.shop_id ?? "")); return { ok: true, data: vmFor(req?.shop_id ?? "s1", 2) }; },
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
  };
  return { api, calls };
}

test("switching shop loads a fresh authoritative snapshot (no previous shop data shown)", async () => {
  const { api, calls } = makeApi();
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.selectShop("s2");
  assert.equal(store.getState().selectedShopId, "s2");
  assert.equal(store.getState().viewModel?.conversation?.conversation_id, "c-s2");
  assert.ok(calls.includes("snapshot:s2"));
});

test("stale event for the previously selected shop cannot leak into the new projection", async () => {
  const { api } = makeApi();
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.selectShop("s2");
  await store.onEvent({ event: "SuggestionReady", revision: 2, shop_id: "s1" });
  // The old shop's suggestion must not appear in the current VM.
  assert.equal(store.getState().viewModel?.selected_shop_id, "s2");
  assert.notEqual(store.getState().viewModel?.conversation?.conversation_id, "c-s1");
});

test("switching shop clears pending UI commands", async () => {
  const { api } = makeApi();
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.selectShop("s1");
  assert.equal(store.getState().pendingCommand, null);
});
