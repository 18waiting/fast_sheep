#!/usr/bin/env node
import assert from "node:assert/strict";
import { PddPlatformService } from "../apps/desktop/dist/main/platforms/pdd/pdd-platform-service.js";

class FakeView {
  visible = false;
  webContents = {
    destroyed: false,
    send: () => {},
    isDestroyed: () => this.webContents.destroyed,
  };
  async loadLocalFixture() {}
  show() { this.visible = true; }
  hide() { this.visible = false; }
  setBounds() {}
  dispose() { this.webContents.destroyed = true; }
  get isVisible() { return this.visible; }
}

function resolution(value) {
  return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value };
}

function baseIdentity(document, message) {
  const conversation = message.content === "second" ? "conversation-2" : "conversation-1";
  return {
    runtimeShop: resolution({ value: document.shopId }),
    merchantId: resolution("merchant-1"),
    storeId: resolution("store-1"),
    platformAccountId: resolution("account-1"),
    internalConversationId: resolution(conversation),
    runtimeConversationReference: resolution({ value: "runtime-" + conversation }),
    localMessageId: { status: "UNKNOWN" },
  };
}

function payload(overrides = {}) {
  return {
    content: "  smoke content\\n",
    from: { role: "user", uid: "1001" },
    to: { role: "mall_cs", uid: "opaque-cs" },
    msg_id: "msg-1",
    ...overrides,
  };
}

const collected = [];
const counters = { ai: 0, human: 0, focus: 0, legacyInbound: 0, transportSend: 0, persistenceWrites: 0 };
const wrappedAdapters = new Set();
const service = new PddPlatformService({
  navigationMode: "FIXTURE",
  orchestrator: {
    onBuyerMessage: async () => { counters.ai += 1; },
    onHumanTakeover: async () => { counters.human += 1; },
    onFocusShop: () => { counters.focus += 1; },
  },
  fixturePathFor: () => "/fixture.html",
  makeView: () => new FakeView(),
  resolveInboundIdentity: (message, document) => baseIdentity(document, message),
  onInboundMessage: async () => { counters.legacyInbound += 1; },
  onCanonicalInbound: (envelope) => collected.push(envelope),
});

async function activateReady(shopId) {
  await service.activate(shopId);
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId });
  const sender = service.webContentsFor(shopId);
  assert.ok(sender);
  const adapter = service.adapterFor(shopId);
  if (adapter && !wrappedAdapters.has(adapter)) {
    const originalSendText = adapter.sendText.bind(adapter);
    adapter.sendText = async (...args) => { counters.transportSend += 1; return originalSendText(...args); };
    wrappedAdapters.add(adapter);
  }
  const context = service.createInboundIngressContext(sender);
  assert.ok(context);
  return { sender, context };
}

const a = await activateReady("shop-a");
const normal = service.handleTrustedInboundIngress(a.sender, a.context, {
  payload: payload(),
  sourceOccurredAt: "2026-09-17T12:00:00Z",
});
assert.equal(normal.status, "MAPPED");
assert.equal(collected.length, 1);
assert.equal(collected[0].sourceContent.text, "  smoke content\\n");
assert.equal(collected[0].sourceOccurredAt, "2026-09-17T12:00:00Z");

const b = await activateReady("shop-b");
const crossShop = service.handleTrustedInboundIngress(b.sender, a.context, { payload: payload() });
assert.equal(crossShop.status, "REJECTED");
assert.equal(crossShop.reason, "INVALID_DOCUMENT_CONTEXT");

await service.reload("shop-a");
service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" });
const stale = service.handleTrustedInboundIngress(a.sender, a.context, { payload: payload() });
assert.equal(stale.status, "REJECTED");

const freshA = service.createInboundIngressContext(a.sender);
assert.ok(freshA);
const sameId1 = service.handleTrustedInboundIngress(a.sender, freshA, { payload: payload({ content: "first", msg_id: "same-id" }) });
const sameId2 = service.handleTrustedInboundIngress(a.sender, freshA, { payload: payload({ content: "second", msg_id: "same-id" }) });
assert.equal(sameId1.status, "MAPPED");
assert.equal(sameId2.status, "MAPPED");
assert.equal(collected.length, 3);

assert.equal(counters.ai, 0);
assert.equal(counters.human, 0);
assert.equal(counters.legacyInbound, 0);
assert.equal(counters.transportSend, 0);
assert.equal(counters.persistenceWrites, 0);

console.log(JSON.stringify({
  smoke: "SHEEP-301_BOUNDED_FIXTURE_MAPPING",
  result: "PASS",
  normal_output: normal.status,
  cross_shop: crossShop.reason,
  reload_stale: stale.reason,
  same_message_id_both_output: [sameId1.status, sameId2.status],
  ai_calls: counters.ai,
  transport_send_calls: counters.transportSend,
  persistence_writes: counters.persistenceWrites,
}, null, 2));