import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY_HANDLERS } from "../dist/main/ipc/query-handlers.js";
import { COMMAND_HANDLERS } from "../dist/main/ipc/command-handlers.js";

function makeCoordinator() {
  const statuses = new Map<string, unknown>();
  const calls: string[] = [];
  const coordinator = {
    calls,
    status: (platform: string, shopId: string) => statuses.get(shopId) ?? null,
    activateShop: async (platform: string, shopId: string) => { calls.push("activate:" + platform + ":" + shopId); return true; },
    setViewBounds: (platform: string, shopId: string) => { calls.push("bounds:" + platform + ":" + shopId); return true; },
    reload: async (platform: string, shopId: string) => { calls.push("reload:" + platform + ":" + shopId); return true; },
    isTrustedWebContents: () => false,
    handlePageEvent: () => {},
    handleCommandResult: () => {},
    disposeAll: () => {},
  } as never;
  return { coordinator, calls, statuses };
}

test("platform.status query returns the platform status view", async () => {
  const { coordinator, statuses } = makeCoordinator();
  statuses.set("shop-1", { shop_id: "shop-1", platform: "pdd", session_status: "READY", view_visible: true });
  const handler = QUERY_HANDLERS["platform.status"]({ coordinator, platformForShop: (s) => (s === "shop-1" ? "pdd" : null) } as never);
  const res = await handler({ shop_id: "shop-1" });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.session_status, "READY");
});

test("platform.status unknown shop -> not_found", async () => {
  const { coordinator } = makeCoordinator();
  const handler = QUERY_HANDLERS["platform.status"]({ coordinator, platformForShop: () => null } as never);
  const res = await handler({ shop_id: "nope" });
  assert.equal(res.ok, false);
});

test("platform.activate_shop routes via the coordinator", async () => {
  const { coordinator, calls } = makeCoordinator();
  const handler = COMMAND_HANDLERS["platform.activate_shop"]({ orchestrator: {} as never, coordinator, platformForShop: (s) => (s === "shop-1" ? "pdd" : null) } as never);
  const res = await handler({ shop_id: "shop-1" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["activate:pdd:shop-1"]);
});

test("platform.set_view_bounds routes via the coordinator", async () => {
  const { coordinator, calls } = makeCoordinator();
  const handler = COMMAND_HANDLERS["platform.set_view_bounds"]({
    orchestrator: {} as never, coordinator, platformForShop: (s) => (s === "shop-1" ? "pdd" : null),
    contentBounds: () => ({ x: 0, y: 0, width: 800, height: 600, visible: true }),
  } as never);
  const res = await handler({ shop_id: "shop-1", x: 10, y: 10, width: 500, height: 400, visible: true });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["bounds:pdd:shop-1"]);
});

test("platform.reload routes via the coordinator", async () => {
  const { coordinator, calls } = makeCoordinator();
  const handler = COMMAND_HANDLERS["platform.reload"]({ orchestrator: {} as never, coordinator, platformForShop: (s) => (s === "shop-1" ? "pdd" : null) } as never);
  const res = await handler({ shop_id: "shop-1" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["reload:pdd:shop-1"]);
});
