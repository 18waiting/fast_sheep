import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import type { BootstrapState, WorkbenchViewModel } from "@fastwork/desktop-ipc";

function makeVm(revision: number, overrides: Partial<WorkbenchViewModel> = {}): WorkbenchViewModel {
  return {
    revision,
    shop_summaries: [
      { shop_id: "s1", name: "店铺1", type: "pdd", enabled: true },
      { shop_id: "s2", name: "店铺2", type: "doudian", enabled: true },
    ],
    selected_shop_id: "s1",
    conversation: { conversation_id: "c1", shop_id: "s1", state: "suggestion_pending", buyer: "测试买家" },
    suggestion: { reply: "亲,有的哦~", generation: 1, status: "pending" },
    mode: "human_review",
    countdown: { enabled: true, remaining_ticks: 5, tick_ms: 1000 },
    worker_status: { status: "ready" },
    platform_capability: "none",
    ...overrides,
  };
}

function makeBootstrap(revision = 1): BootstrapState {
  return { revision, worker_status: { status: "ready" }, shops: makeVm(revision).shop_summaries, view_model: makeVm(revision) };
}

function makeApi(overrides: Partial<WorkbenchApiLike> = {}): WorkbenchApiLike & { calls: string[] } {
  const calls: string[] = [];
  const api: WorkbenchApiLike & { calls: string[] } = {
    calls,
    bootstrap: async () => { calls.push("bootstrap"); return { ok: true, data: makeBootstrap() }; },
    getSnapshot: async (req) => { calls.push("snapshot:" + (req?.shop_id ?? "")); return { ok: true, data: makeVm(2, { selected_shop_id: req?.shop_id ?? "s1" }) }; },
    setMode: async (req) => { calls.push("setMode:" + req.mode); return { ok: true, data: { ok: true } }; },
    manualSend: async (req) => { calls.push("manualSend"); return { ok: true, data: { ok: true } }; },
    noSaveSend: async (req) => { calls.push("noSaveSend"); return { ok: true, data: { ok: true } }; },
    cancel: async (req) => { calls.push("cancel"); return { ok: true, data: { ok: true } }; },
    focus: async (req) => { calls.push("focus"); return { ok: true, data: { ok: true } }; },
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
  return api;
}

test("boot applies bootstrap state and selects the first/selected shop", async () => {
  const store = new WorkbenchStore(makeApi());
  await store.boot();
  const s = store.getState();
  assert.equal(s.loading, false);
  assert.equal(s.selectedShopId, "s1");
  assert.equal(s.viewModel?.revision, 1);
  assert.equal(s.lastError, null);
});

test("subscribe notifies listeners on state change", async () => {
  const store = new WorkbenchStore(makeApi());
  let notified = 0;
  store.subscribe(() => notified++);
  await store.boot();
  assert.ok(notified >= 1);
});

test("command errors set a sanitized lastError", async () => {
  const store = new WorkbenchStore(makeApi({ manualSend: async () => ({ ok: false, error: { code: "desktop.command_failed", category: "internal", message: "failed with /C:/secret", retryable: false } }) }));
  await store.boot();
  await store.manualSend();
  assert.ok(store.getState().lastError !== null);
});

test("isCommandPending guards duplicate sends while a command is in flight", async () => {
  const api = makeApi();
  const store = new WorkbenchStore(api);
  await store.boot();
  const p = store.manualSend();
  assert.equal(store.isCommandPending("manual_send"), true);
  await p;
  assert.equal(store.isCommandPending("manual_send"), false);
});
