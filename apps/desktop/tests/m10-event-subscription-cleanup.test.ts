import { test } from "node:test";
import type { WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import assert from "node:assert/strict";
import { createSubscriptions, type SubscribeFn } from "../dist/preload/subscriptions.js";

test("M10 subscriptions return unsubscribe and remove the exact listener", () => {
  const removed: string[] = [];
  const listeners = new Map<string, Array<(event: unknown, payload: unknown) => void>>();
  const subscribe: SubscribeFn = (channel, listener) => {
    const arr = listeners.get(channel) ?? [];
    arr.push(listener);
    listeners.set(channel, arr);
    return () => {
      const cur = listeners.get(channel) ?? [];
      listeners.set(channel, cur.filter((l) => l !== listener));
      removed.push(channel);
    };
  };
  const subs = createSubscriptions(subscribe);
  const unsubs = [
    subs.onJobsChanged(() => {}),
    subs.onLearningChanged(() => {}),
    subs.onReviewChanged(() => {}),
    subs.onAuditChanged(() => {}),
    subs.onOptimizationChanged(() => {}),
  ];
  assert.equal(listeners.size, 5);
  for (const u of unsubs) u();
  assert.equal(removed.length, 5);
  for (const [, arr] of listeners) assert.equal(arr.length, 0, "listener removed after unsubscribe");
});

test("subscription handlers receive normalized payloads", () => {
  const received: string[] = [];
  const subscribe: SubscribeFn = (_channel, listener) => {
    listener(null, { event: "learning.finished", job_id: "j1" });
    return () => {};
  };
  const subs = createSubscriptions(subscribe);
  subs.onLearningChanged((ev) => received.push(ev.event));
  assert.deepEqual(received, ["learning.finished"]);
});

test("store subscription cleanup removes listeners on unsubscribe", async () => {
const { WorkbenchStore } = await import("../dist/renderer/state/workbench-store.js");
  const api: WorkbenchApiLike = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: { revision: 1, shop_summaries: [], worker_status: { status: "ready" }, platform_capability: "none" } } }),
    getSnapshot: async () => ({ ok: true, data: { revision: 1, shop_summaries: [], worker_status: { status: "ready" }, platform_capability: "none" } }),
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
  const store = new WorkbenchStore(api);
  let notified = 0;
  const unsub = store.subscribe(() => { notified += 1; });
  await store.refreshJobs(); // no-op (API has no listJobs)
  unsub();
  const before = notified;
  await store.boot();
  assert.equal(notified, before, "unsubscribed listener is not notified");
});
