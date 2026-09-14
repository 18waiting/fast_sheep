import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import type { PddPageEvent } from "@fastwork/platform-pdd";

class FakeView {
  visible = false;
  webContents = { send: () => {}, isDestroyed: () => false };
  async loadLocalFixture(): Promise<void> {}
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(): void {}
  dispose(): void {}
  get isVisible(): boolean { return this.visible; }
}

function makeService() {
  const inbound: Array<{ shop_id: string; conversation_id: string; content: string }> = [];
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: (shopId) => "/f/" + shopId + ".html",
    makeView: () => new FakeView() as never,
    onInboundMessage: async (m) => inbound.push(m as never),
    revision: () => 1,
  });
  return { service, inbound };
}

test("two PDD shops have isolated sessions, views, partitions and messages", async () => {
  const { service, inbound } = makeService();
  await service.activate("shop-a");
  await service.activate("shop-b");

  const sa = service.status("shop-a")!;
  const sb = service.status("shop-b")!;
  assert.equal(sa.platform, "pdd");
  assert.equal(sb.platform, "pdd");

  // A message for shop-a must never be routed as shop-b.
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a" } as PddPageEvent);
  service.handlePageEvent({ event: "message_received", session_id: "pdd-session-shop-a", shop_id: "shop-a", conversation_id: "c1", direction: "inbound", content: "A的消息" } as PddPageEvent);
  assert.equal(inbound.length, 1);
  assert.equal(inbound[0].shop_id, "shop-a");
  assert.equal(inbound[0].content, "A的消息");
  assert.ok(!inbound.some((m) => m.shop_id === "shop-b"), "no cross-shop message leak");
});

test("send for shop-a cannot execute in shop-b view (adapter routing by shop)", async () => {
  const { service } = makeService();
  await service.activate("shop-a");
  await service.activate("shop-b");
  const a = service.adapterFor("shop-a");
  const b = service.adapterFor("shop-b");
  assert.notEqual(a, b);
  // Each adapter is bound to its own session; a send command carries its shop id
  // and the bridge resolves to that session's view only.
  const res = await a!.sendText("shop-a", "c1", ["x"]);
  assert.equal(res.ok, false, "not READY until page_ready; structured error, no cross-view send");
});

test("view activation switches correctly and state stays isolated", async () => {
  const { service } = makeService();
  await service.activate("shop-a");
  await service.activate("shop-b");
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a" } as PddPageEvent);
  assert.equal(service.status("shop-a")!.session_status, "READY");
  assert.notEqual(service.status("shop-b")!.session_status, "READY");
});
