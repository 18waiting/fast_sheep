import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionCoordinator } from "../dist/main/platforms/platform-session-coordinator.js";

function fakeService(platform: string) {
  let current: string | null = null;
  return {
    hideAllViews: () => { current = null; },
    activate: async (shopId: string) => { current = shopId; },
    status: (shopId: string) => ({ shop_id: shopId, platform, session_status: "READY", view_visible: shopId === current }),
    setViewBounds: () => true,
    reload: async () => true,
    isTrustedPddWebContents: () => false,
    handlePageEvent: () => {},
    handleCommandResult: () => {},
    disposeAll: () => {},
  } as never;
}

// FastWork realignment B3: shop switching is exercised on the single canonical
// platform host (PDD) across multiple shops.
test("shop switch activates the new shop and projects correct status", async () => {
  const c = new PlatformSessionCoordinator();
  c.register("pdd", fakeService("pdd") as never);
  await c.activateShop("pdd", "shop-a");
  await c.activateShop("pdd", "shop-b");
  assert.equal(c.status("pdd", "shop-b")?.view_visible, true);
  assert.equal(c.status("pdd", "shop-a")?.view_visible, false);
});

test("a third shop switch keeps exactly one visible target", async () => {
  const c = new PlatformSessionCoordinator();
  c.register("pdd", fakeService("pdd") as never);
  for (const shop of ["shop-a", "shop-b", "shop-c"]) await c.activateShop("pdd", shop);
  assert.equal(c.status("pdd", "shop-c")?.view_visible, true);
  assert.equal(c.status("pdd", "shop-b")?.view_visible, false);
  assert.equal(c.status("pdd", "shop-a")?.view_visible, false);
});
