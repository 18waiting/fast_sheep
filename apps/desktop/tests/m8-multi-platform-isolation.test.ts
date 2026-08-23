import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionCoordinator } from "../dist/main/platforms/platform-session-coordinator.js";

function fakeService(platform: string) {
  const inbound: string[] = [];
  const disposed: string[] = [];
  return {
    platform, inbound, disposed,
    activate: async (shopId: string) => { inbound.push("activate:" + shopId); },
    status: (shopId: string) => ({ shop_id: shopId, platform, session_status: "READY", view_visible: true }),
    setViewBounds: () => true,
    reload: async () => true,
    isTrustedWebContents: () => false,
    handlePageEvent: (p: unknown) => { inbound.push("event:" + (p as { shop_id?: string }).shop_id); },
    handleCommandResult: () => {},
    disposeAll: () => { disposed.push("dispose"); },
  } as never;
}

test("six platform sessions coexist and inbound never cross-routes", async () => {
  const c = new PlatformSessionCoordinator();
  const services = new Map<string, ReturnType<typeof fakeService>>();
  for (const pid of ["pdd", "doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    const svc = fakeService(pid);
    services.set(pid, svc);
    c.register(pid as never, svc as never);
  }
  for (const pid of ["pdd", "doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    await c.activateShop(pid as never, "shop-" + pid);
  }
  c.handlePageEvent("doudian", { event: "message_received", session_id: "s", shop_id: "shop-doudian" });
  const doudian = services.get("doudian")!;
  assert.ok(doudian.inbound.some((x) => x.startsWith("event:shop-doudian")));
  assert.ok(!services.get("jd")!.inbound.some((x) => x.startsWith("event:shop-doudian")), "no cross-routing");
  c.disposeAll();
  assert.equal(c.entries().length, 0);
});

test("partitions differ by shop across platforms", async () => {
  const { platformPartitionFor } = await import("../dist/main/platforms/shared/platform-session-partition.js");
  const parts = ["shop-a", "shop-b", "shop-c", "shop-d", "shop-e", "shop-f"].map((s) => platformPartitionFor(s));
  assert.equal(new Set(parts).size, 6);
  assert.ok(parts.every((p) => /^persist:shop-[A-Za-z0-9._-]+$/.test(p)));
});
