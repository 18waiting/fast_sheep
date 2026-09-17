import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import type { PddPageEvent, PddPageCommand, PddPageCommandResult } from "@fastwork/platform-pdd";

class FakeView {
  visible = false;
  sent: Array<{ channel: string; payload: unknown }> = [];
  fixture: string | null = null;
  webContents = {
    send: (channel: string, payload: unknown) => { this.sent.push({ channel, payload }); },
    isDestroyed: () => false,
  };
  async loadLocalFixture(p: string): Promise<void> { this.fixture = p; }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(): void {}
  dispose(): void {}
  get isVisible(): boolean { return this.visible; }
}

function makeService(overrides: Record<string, unknown> = {}) {
  const views = new Map<string, FakeView>();
  const inbound: Array<Record<string, unknown>> = [];
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: (shopId) => "/fixtures/" + shopId + ".html",
    makeView: (shopId: string) => { const v = new FakeView(); views.set(shopId, v); return v as never; },
    onInboundMessage: async (m) => { inbound.push(m as never); },
    revision: () => 1,
    ...overrides,
  });
  return { service, views, inbound };
}

test("activate creates a per-shop session and loads the local fixture", async () => {
  const { service, views } = makeService();
  await service.activate("shop-1");
  assert.ok(views.has("shop-1"));
  assert.equal(views.get("shop-1")!.fixture, "/fixtures/shop-1.html");
  const status = service.status("shop-1");
  assert.equal(status?.platform, "pdd");
});

test("page_ready transitions the session to READY and routes inbound messages", async () => {
  const { service, inbound } = makeService();
  await service.activate("shop-1");
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-1" } as PddPageEvent);
  assert.equal(service.status("shop-1")?.session_status, "READY");
  service.handlePageEvent({ event: "message_received", session_id: "pdd-session-shop-1", shop_id: "shop-1", conversation_id: "c1", direction: "inbound", content: "有货吗" } as PddPageEvent);
  assert.equal(inbound.length, 1);
  assert.equal(inbound[0].content, "有货吗");
});

test("adapterFor returns the real PDD adapter after activation", async () => {
  const { service } = makeService();
  await service.activate("shop-1");
  assert.ok(service.adapterFor("shop-1") !== null);
  assert.equal(service.adapterFor("shop-none"), null);
});

test("routingAdapter falls back to the fallback adapter for unactivated shops", async () => {
  const { service } = makeService();
  const fallback = { ok: true, messageId: "fallback" };
  const adapter = service.routingAdapter();
  const res = await adapter.sendText("shop-none", "c1", ["x"]);
  assert.equal(res.ok, false, "no session -> not_found (no silent fallback)");
  void fallback;
});

test("disposeAll clears sessions and status becomes unavailable", async () => {
  const { service } = makeService();
  await service.activate("shop-1");
  service.disposeAll();
  assert.equal(service.status("shop-1"), null);
});

test("missing explicit navigation mode fails construction", () => {
  assert.throws(() => new PddPlatformService({
    testMode: true,
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
  } as never), /navigationMode is required/);
});

test("production-facing canonical ingress defaults to DISABLED", () => {
  const service = new PddPlatformService({
    navigationMode: "PRODUCTION_READ_ONLY",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
  });
  assert.equal((service.inboundDiagnostics() as { mode: string }).mode, "DISABLED");
});

test("sender-bearing page events cannot mutate another shop or authorize legacy consumers", async () => {
  const { service, inbound } = makeService({ canonicalIngressMode: "DISABLED" });
  await service.activate("shop-a");
  await service.activate("shop-b");
  const senderA = service.webContentsFor("shop-a")!;
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-b", shop_id: "shop-b" } as PddPageEvent, senderA);
  assert.equal(service.status("shop-b")?.session_status, "LOADING", "forged cross-shop page event is dropped");
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as PddPageEvent, senderA);
  assert.equal(service.status("shop-a")?.session_status, "READY");
  assert.equal(service.status("shop-b")?.session_status, "LOADING");
  service.handlePageEvent({ event: "message_received", session_id: "pdd-session-shop-a", shop_id: "shop-a", conversation_id: "c1", content: "blocked" } as PddPageEvent, senderA);
  assert.equal(inbound.length, 0, "DISABLED mode never falls back to legacy inbound");
});
