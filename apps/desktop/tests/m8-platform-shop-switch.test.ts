import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionCoordinator } from "../dist/main/platforms/platform-session-coordinator.js";

function fakeService(platform: string) {
  let current: string | null = null;
  return {
    activate: async (shopId: string) => { current = shopId; },
    status: (shopId: string) => ({ shop_id: shopId, platform, session_status: "READY", view_visible: shopId === current }),
    setViewBounds: () => true,
    reload: async () => true,
    isTrustedWebContents: () => false,
    handlePageEvent: () => {},
    handleCommandResult: () => {},
    disposeAll: () => {},
  } as never;
}

test("shop switch activates the new shop and projects correct status", async () => {
  const c = new PlatformSessionCoordinator();
  c.register("doudian", fakeService("doudian") as never);
  await c.activateShop("doudian", "shop-a");
  await c.activateShop("doudian", "shop-b");
  assert.equal(c.status("doudian", "shop-b")?.view_visible, true);
  assert.equal(c.status("doudian", "shop-a")?.view_visible, false);
});
