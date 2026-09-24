import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore } from "../dist/renderer/state/workbench-store.js";

const shops = [
  { shop_id: "a", type: "pdd" },
  { shop_id: "b", type: "pdd" },
  { shop_id: "local", type: "jd" },
];
const vm = { selected_shop_id: "a", shop_summaries: shops } as never;
const ready = (shopId: string) => ({ shop_id: shopId, platform: "pdd", session_status: "READY", view_visible: true });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

test("old Shop status event and query result cannot replace selected Shop", async () => {
  const store = new WorkbenchStore({
    getSnapshot: async () => ({ ok: true, data: vm }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    getPlatformStatus: async ({ shop_id }: { shop_id: string }) => ({ ok: true, data: ready(shop_id) }),
  } as never);
  store.applyViewModel(vm);
  store.applyPlatformStatus(ready("a"));
  await store.selectShop("b");
  store.applyPlatformStatusChanged({ shop_id: "a", session_status: "LOGIN_REQUIRED", revision: 2 });
  store.applyPlatformStatus({ ...ready("a"), session_status: "LOGIN_REQUIRED" });
  assert.equal(store.getState().selectedShopId, "b");
  assert.equal(store.getState().platform.activeShopId, "b");
  assert.equal(store.getState().platform.sessionStatus, "READY", "old-Shop event and query result ignored");
});

test("out-of-order A activation/status cannot overwrite selected B", async () => {
  const a = deferred<{ ok: true; data: { ok: boolean } }>();
  const api = {
    getSnapshot: async () => ({ ok: true, data: vm }),
    activatePlatformShop: async ({ shop_id }: { shop_id: string }) => shop_id === "a" ? a.promise : { ok: true, data: { ok: true } },
    getPlatformStatus: async ({ shop_id }: { shop_id: string }) => ({ ok: true, data: ready(shop_id) }),
  } as never;
  const store = new WorkbenchStore(api);
  store.applyViewModel(vm);
  const pendingA = store.selectShop("a");
  await Promise.resolve();
  const pendingB = store.selectShop("b");
  await pendingB;
  a.resolve({ ok: true, data: { ok: true } });
  await pendingA;
  store.applyPlatformStatusChanged({ shop_id: "a", session_status: "LOGIN_REQUIRED", revision: 3 });
  store.applyPlatformStatus(ready("a"));
  assert.equal(store.getState().selectedShopId, "b");
  assert.equal(store.getState().platform.activeShopId, "b");
  assert.equal(store.getState().platform.sessionStatus, "READY");
});

test("old surface bounds cannot target the newly selected Shop", async () => {
  const calls: string[] = [];
  const store = new WorkbenchStore({
    getSnapshot: async () => ({ ok: true, data: vm }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    getPlatformStatus: async ({ shop_id }: { shop_id: string }) => ({ ok: true, data: ready(shop_id) }),
    setPlatformViewBounds: async ({ shop_id }: { shop_id: string }) => { calls.push(shop_id); return { ok: true, data: { ok: true } }; },
  } as never);
  store.applyViewModel(vm);
  store.applyPlatformStatus(ready("a"));
  await store.reportPlatformBounds("a", { x: 0, y: 0, width: 100, height: 100, visible: true });
  await store.selectShop("b");
  await store.reportPlatformBounds("a", { x: 0, y: 0, width: 100, height: 100, visible: true });
  await store.reportPlatformBounds("b", { x: 0, y: 0, width: 100, height: 100, visible: true });
  assert.deepEqual(calls, ["a", "b"]);
});

test("switching from PDD to a non-embedded Shop sends a hidden bounds command", async () => {
  const calls: Array<{ shop_id: string; visible: boolean }> = [];
  const store = new WorkbenchStore({
    getSnapshot: async () => ({ ok: true, data: vm }),
    setPlatformViewBounds: async (request: { shop_id: string; visible: boolean }) => {
      calls.push({ shop_id: request.shop_id, visible: request.visible });
      return { ok: true, data: { ok: true } };
    },
  } as never);
  store.applyViewModel(vm);
  store.applyPlatformStatus(ready("a"));
  await store.selectShop("local");
  assert.deepEqual(calls, [{ shop_id: "a", visible: false }]);
  assert.equal(store.getState().platform.activeShopId, null);
});


test("rapid A -> B -> non-embedded selection closes pending B and ignores its late result", async () => {
  const b = deferred<{ ok: true; data: { ok: boolean } }>();
  const calls: Array<{ shop_id: string; visible: boolean }> = [];
  const store = new WorkbenchStore({
    getSnapshot: async () => ({ ok: true, data: vm }),
    activatePlatformShop: async ({ shop_id }: { shop_id: string }) => shop_id === "b" ? b.promise : { ok: true, data: { ok: true } },
    getPlatformStatus: async ({ shop_id }: { shop_id: string }) => ({ ok: true, data: ready(shop_id) }),
    setPlatformViewBounds: async (req: { shop_id: string; visible: boolean }) => {
      calls.push({ shop_id: req.shop_id, visible: req.visible });
      return { ok: true, data: { ok: true } };
    },
  } as never);
  store.applyViewModel(vm);
  store.applyPlatformStatus(ready("a"));
  const pendingB = store.selectShop("b");
  const local = store.selectShop("local");
  await local;
  assert.deepEqual(calls, [{ shop_id: "b", visible: false }]);
  b.resolve({ ok: true, data: { ok: true } });
  await pendingB;
  assert.equal(store.getState().selectedShopId, "local");
  assert.equal(store.getState().platform.activeShopId, null);
});
