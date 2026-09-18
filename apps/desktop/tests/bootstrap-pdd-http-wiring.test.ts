import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMainContext } from "../dist/main/bootstrap.js";
import { decodePddLatestConversationsPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));

class FakeView {
  visible = false;
  webContents = { destroyed: false, send: () => {}, isDestroyed() { return false; } };
  async loadLocalFixture() {}
  show() {}
  hide() {}
  setBounds() {}
  dispose() {}
  setDocumentLifecycleObserver() {}
  startDocumentObservation() {}
  get isVisible() { return this.visible; }
}

const RES = { status: "RESOLVED" };
function scopeObj() {
  return {
    merchantId: { ...RES, value: "merchant-test-1" },
    storeId: { ...RES, value: "store-test" },
    platformAccountId: { ...RES, value: "account-test" },
  };
}

test("Main composition: HTTP response body reaches persistence through the real path", async () => {
  const captured = [];
  const opts = {
    testMode: true,
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => ({ granted: true, admissionId: "composition-admission" }) },
    allowedInboundHttpRequest: (method, url) => method === "POST" && url === "https://example.invalid/plateau/chat/latest_conversations",
    decodeInboundHttpBody: (body) => {
      const decoded = decodePddLatestConversationsPayload(body);
      if (decoded.status !== "DECODED") return null;
      const inputs = [];
      for (const m of decoded.messages) if (m.ingressInput) inputs.push(m.ingressInput);
      return inputs;
    },
    resolveInboundScope: () => scopeObj(),
    resolveInboundIdentity: (message, document) => ({
      runtimeShop: { ...RES, value: { value: document.shopId } },
      scope: scopeObj(),
      runtimeConversationReference: { ...RES, value: { value: "runtime-" + message.customerUid } },
      association: {
        ownerRuntimeShopId: document.shopId,
        ownerScope: scopeObj(),
        platformCustomerId: message.customerUid,
        platformMessageId: message.platformMessageId,
        internalConversationId: { ...RES, value: "conversation-composition" },
        localMessageId: { ...RES, value: "local-composition" },
      },
    }),
    makeView: () => new FakeView(),
    createInboundObserver: (options) => {
      captured.push(options);
      return {
        observerId: "fake-observer",
        activeLifecycleId: 1,
        isTerminal: false,
        get targetWebContents() { return options.webContents; },
        start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
        stop: () => undefined,
        snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, enabled: true, terminal: false }),
      };
    },
  };
  const ctx = createMainContext(opts);
  const service = ctx.platform;
  try {
    const shopId = "shop-test-1";
    await service.activate(shopId);
    const sender = service.webContentsFor(shopId);
    service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId }, sender);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(service.status(shopId)?.session_status, "READY");
    const observerOptions = captured[0];
    const binding = observerOptions.getDocumentBinding();
    assert.ok(binding, "live document binding available before READY frames");
    const connection = { webContents: observerOptions.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-composition", url: "https://example.invalid/plateau/chat/latest_conversations" };
    observerOptions.onHttpRequest({ connection, method: "POST", url: connection.url });
    observerOptions.onHttpResponse({ binding: { connection, method: "POST", url: connection.url }, status: 200, mimeType: "application/json", body: JSON.stringify(sample.latest_conversations_customer_inbound) });
    assert.equal(ctx.inboundReceipt.ingested, 1, "one inbound message persisted through the composition");
    assert.equal(ctx.inboundReceipt.rejected, 0, "no rejection on the happy path");
    assert.equal(ctx.messages.listByConversation("conversation-composition").length, 1);
    const stored = ctx.messages.listByConversation("conversation-composition")[0];
    assert.equal(stored.contentText, "有货吗");
    assert.equal(stored.actor, "customer");
    assert.equal(stored.externalRef, "1700000000005", "authoritative msg_id stored verbatim");
  } finally {
    ctx.platform.disposeAll();
  }
});

test("Main composition: agent-authored and malformed bodies persist nothing", async () => {
  const captured = [];
  const opts = {
    testMode: true,
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => ({ granted: true, admissionId: "composition-admission" }) },
    allowedInboundHttpRequest: () => true,
    decodeInboundHttpBody: (body) => {
      const decoded = decodePddLatestConversationsPayload(body);
      if (decoded.status !== "DECODED") return null;
      const inputs = [];
      for (const m of decoded.messages) if (m.ingressInput) inputs.push(m.ingressInput);
      return inputs;
    },
    resolveInboundScope: () => scopeObj(),
    resolveInboundIdentity: (message, document) => ({
      runtimeShop: { ...RES, value: { value: document.shopId } },
      scope: scopeObj(),
      runtimeConversationReference: { ...RES, value: { value: "runtime" } },
      association: { ownerRuntimeShopId: document.shopId, ownerScope: scopeObj(), platformCustomerId: message.customerUid, platformMessageId: message.platformMessageId, internalConversationId: { ...RES, value: "conversation-x" }, localMessageId: { ...RES, value: "local-x" } },
    }),
    makeView: () => new FakeView(),
    createInboundObserver: (options) => {
      captured.push(options);
      return {
        observerId: "fake-observer", activeLifecycleId: 1, isTerminal: false,
        get targetWebContents() { return options.webContents; },
        start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }), stop: () => undefined,
        snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, enabled: true, terminal: false }),
      };
    },
  };
  const ctx = createMainContext(opts);
  try {
    const shopId = "shop-test-1";
    await serviceReady(ctx.platform, shopId);
    const o = captured[0];
    const b = o.getDocumentBinding();
    const conn = { webContents: o.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: b.sessionId, shopId, documentGeneration: b.documentGeneration, cdpSessionId: "", requestId: "r", url: "https://example.invalid/x" };
    for (const body of [JSON.stringify(sample.latest_conversations_agent_message), "{not json", JSON.stringify(sample.unsupported_shape)]) {
      o.onHttpRequest({ connection: conn, method: "POST", url: conn.url });
      o.onHttpResponse({ binding: { connection: conn, method: "POST", url: conn.url }, status: 200, mimeType: "application/json", body });
    }
    assert.equal(ctx.inboundReceipt.ingested, 0, "nothing persisted");
    assert.equal(ctx.messages.listByConversation("conversation-x").length, 0);
  } finally {
    ctx.platform.disposeAll();
  }
});

async function serviceReady(service, shopId) {
  await service.activate(shopId);
  const sender = service.webContentsFor(shopId);
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId }, sender);
  await new Promise((r) => setTimeout(r, 30));
}
