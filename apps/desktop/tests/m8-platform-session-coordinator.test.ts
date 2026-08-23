import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionCoordinator } from "../dist/main/platforms/platform-session-coordinator.js";

function fakeService(platform: string) {
  const activated: string[] = [];
  return {
    platform,
    activated,
    activate: async (shopId: string) => { activated.push(shopId); },
    status: (shopId: string) => ({ shop_id: shopId, platform, session_status: "READY", view_visible: true }),
    setViewBounds: () => true,
    reload: async () => true,
    isTrustedWebContents: () => false,
    handlePageEvent: () => {},
    handleCommandResult: () => {},
    disposeAll: () => {},
  } as never;
}

test("coordinator creates/gets/disposes sessions per platform", async () => {
  const c = new PlatformSessionCoordinator();
  c.register("doudian", fakeService("doudian") as never);
  c.register("jd", fakeService("jd") as never);
  assert.equal(c.entries().length, 2);
  assert.ok(await c.activateShop("doudian", "s1"));
  assert.equal(c.status("jd", "s1")?.platform, "jd");
  c.disposeAll();
  assert.equal(c.entries().length, 0);
});

test("coordinator isolates sessions (no cross-platform routing)", async () => {
  const c = new PlatformSessionCoordinator();
  c.register("doudian", fakeService("doudian") as never);
  const r = c.setViewBounds("jd", "s1", { x: 0, y: 0, width: 10, height: 10, visible: true }, { x: 0, y: 0, width: 100, height: 100, visible: true });
  assert.equal(r, false, "unknown platform -> false");
});
