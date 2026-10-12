import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionCoordinator } from "../dist/main/platforms/platform-session-coordinator.js";

// FastWork realignment B3: PDD-only MVP. The coordinator owns one canonical
// platform host; everything else must fail closed instead of routing anywhere.
const BOUNDS = { x: 0, y: 0, width: 10, height: 10, visible: true };
const CONTENT = { x: 0, y: 0, width: 100, height: 100, visible: true };
const TRUSTED = { __trusted: true };

function fakeService(platform: string) {
  const activated: string[] = [];
  const pageEvents: unknown[] = [];
  const commandResults: unknown[] = [];
  return {
    platform,
    activated,
    pageEvents,
    commandResults,
    hideAllViews: () => {},
    activate: async (shopId: string) => { activated.push(shopId); },
    status: (shopId: string) => ({ shop_id: shopId, platform, session_status: "READY", view_visible: true }),
    setViewBounds: () => true,
    reload: async () => true,
    isTrustedPddWebContents: (wc: unknown) => wc === TRUSTED,
    handlePageEvent: (payload: unknown) => { pageEvents.push(payload); },
    handleCommandResult: (payload: unknown) => { commandResults.push(payload); },
    disposeAll: () => {},
  };
}

test("coordinator creates/gets/disposes sessions for the single canonical platform", async () => {
  const c = new PlatformSessionCoordinator();
  const svc = fakeService("pdd");
  c.register("pdd", svc as never);
  assert.deepEqual(c.entries().map((e) => e.platform), ["pdd"]);
  assert.ok(await c.activateShop("pdd", "s1"));
  assert.deepEqual(svc.activated, ["s1"]);
  assert.equal(c.status("pdd", "s1")?.platform, "pdd");
  c.disposeAll();
  assert.equal(c.entries().length, 0);
});

test("coordinator isolates sessions (no routing to an unregistered platform)", async () => {
  const c = new PlatformSessionCoordinator();
  c.register("pdd", fakeService("pdd") as never);
  assert.equal(c.setViewBounds("jd" as never, "s1", BOUNDS, CONTENT), false, "unknown platform -> false");
  assert.equal(await c.activateShop("jd" as never, "s1"), false, "unknown platform -> activation refused");
  assert.equal(c.status("jd" as never, "s1"), null);
  assert.equal(await c.reload("jd" as never, "s1"), false);
});

test("trusted-webContents guard is delegated to the platform host and fails closed", () => {
  const c = new PlatformSessionCoordinator();
  c.register("pdd", fakeService("pdd") as never);
  assert.equal(c.isTrustedWebContents("pdd", TRUSTED), true, "host-accepted sender is trusted");
  assert.equal(c.isTrustedWebContents("pdd", {}), false, "host-rejected sender is not trusted");
  assert.equal(c.isTrustedWebContents("jd" as never, TRUSTED), false, "unregistered platform fails closed");
});

test("page events and command results route only to the addressed platform host", () => {
  const c = new PlatformSessionCoordinator();
  const svc = fakeService("pdd");
  c.register("pdd", svc as never);
  c.handlePageEvent("pdd", { event: "page_ready" });
  c.handleCommandResult("pdd", { command_id: "cmd-1", ok: true });
  c.handlePageEvent("jd" as never, { event: "page_ready" });
  c.handleCommandResult("jd" as never, { command_id: "cmd-2", ok: true });
  assert.equal(svc.pageEvents.length, 1);
  assert.equal(svc.commandResults.length, 1);
});
