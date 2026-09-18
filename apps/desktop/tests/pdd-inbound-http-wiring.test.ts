import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { decodePddLatestConversationsPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));

class FakeView {
  visible = false;
  webContents = { destroyed: false, send: () => {}, isDestroyed() { return false; } };
  async loadLocalFixture() {}
  show() { this.visible = true; }
  hide() { this.visible = false; }
  setBounds() {}
  dispose() {}
  setDocumentLifecycleObserver() {}
  startDocumentObservation() {}
  get isVisible() { return this.visible; }
}

const res = (v) => (v === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value: v });
function scopeFor(shopId) {
  return { merchantId: res("merchant-1"), storeId: res("store-" + shopId), platformAccountId: res("account-" + shopId) };
}

function makeService(overrides = {}) {
  const collected = [];
  const capture = [];
  const legacy = [];
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => { legacy.push("buyer"); }, onHumanTakeover: async () => { legacy.push("takeover"); }, onFocusShop: () => { legacy.push("focus"); } },
    fixturePathFor: (s) => "/fixture-" + s + ".html",
    makeView: () => new FakeView(),
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => ({ granted: true, admissionId: "test-admission" }) },
    allowedInboundHttpRequest: (method, url) => method === "POST" && url === "https://example.invalid/plateau/chat/latest_conversations",
    decodeInboundHttpBody: (body) => {
      const decoded = decodePddLatestConversationsPayload(body);
      if (decoded.status !== "DECODED") return null;
      const inputs = [];
      for (const m of decoded.messages) if (m.ingressInput) inputs.push(m.ingressInput);
      return inputs;
    },
    resolveInboundScope: (doc) => scopeFor(doc.shopId),
    resolveInboundIdentity: (message, doc) => ({
      runtimeShop: res({ value: doc.shopId }),
      scope: scopeFor(doc.shopId),
      runtimeConversationReference: res({ value: "runtime-" + doc.shopId }),
      association: message.customerUid === undefined || message.platformMessageId === undefined ? undefined : {
        ownerRuntimeShopId: doc.shopId,
        ownerScope: scopeFor(doc.shopId),
        platformCustomerId: message.customerUid,
        platformMessageId: message.platformMessageId,
        internalConversationId: res("conversation-" + doc.shopId),
        localMessageId: res("local-" + doc.shopId),
      },
    }),
    onCanonicalInbound: (e) => { collected.push(e); },
    onInboundMessage: async (m) => { legacy.push(m); },
    createInboundObserver: ((options) => {
      capture.push(options);
      return {
        observerId: "fake-observer",
        activeLifecycleId: 1,
        isTerminal: false,
        get targetWebContents() { return options.webContents; },
        start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
        stop: () => undefined,
        snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, enabled: true, terminal: false }),
      };
    }),
    ...overrides,
  });
  return { service, collected, legacy, capture };
}

async function waitFor(pred, label, ms = 2000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (pred()) return; await new Promise((r) => setTimeout(r, 5)); }
  throw new Error("timeout: " + label);
}

async function activateReady(service, shopId) {
  await service.activate(shopId);
  const sender = service.webContentsFor(shopId);
  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId }, sender);
  await waitFor(() => service.status(shopId)?.session_status === "READY", "ready " + shopId);
  return sender;
}

function reqParams(requestId, url = "https://example.invalid/plateau/chat/latest_conversations", method = "POST") {
  return { requestId, request: { url, method } };
}
function respParams(requestId, status = 200) { return { requestId, response: { status, mimeType: "application/json" } }; }

test("HTTP wiring: allowed response reaches the collector through real mapper + default validator", async () => {
  const h = makeService();
  try {
    const shopId = "shop-a";
    await activateReady(h.service, shopId);
    const opts = h.capture[0];
    const binding = opts.getDocumentBinding();
    const body = JSON.stringify(sample.latest_conversations_customer_inbound);
    opts.allowedHttpRequest("POST", "https://example.invalid/plateau/chat/latest_conversations");
    opts.onHttpRequest({ connection: { webContents: opts.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-1", url: "https://example.invalid/plateau/chat/latest_conversations" }, method: "POST", url: "https://example.invalid/plateau/chat/latest_conversations" });
    opts.onHttpResponse({ binding: { connection: { webContents: opts.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-1", url: "https://example.invalid/plateau/chat/latest_conversations" }, method: "POST", url: "https://example.invalid/plateau/chat/latest_conversations" }, status: 200, mimeType: "application/json", body });
    assert.equal(h.collected.length, 1, "one inbound envelope collected");
    const lock = h.collected[0].identityLock;
    assert.equal(lock.storeId.value, "store-" + shopId, "scope from trusted Main evidence, not payload");
    assert.equal(lock.triggerMessage.platformMessageIdentity.value, "1700000000005");
    assert.equal(h.collected[0].sourceContent.text, "有货吗");
    assert.equal(lock.triggerMessage.platformMessageIdentity.provenance, "AUTHORITATIVE_PLATFORM_ID");
    assert.equal(h.legacy.length, 0, "legacy consumers untouched");
  } finally { h.service.disposeAll(); }
});

test("HTTP wiring: two shops with identical opaque ids stay isolated", async () => {
  const h = makeService();
  try {
    const bodyA = JSON.stringify(sample.latest_conversations_multi_conversation);
    const results = [];
    for (const shopId of ["shop-a", "shop-b"]) {
      await activateReady(h.service, shopId);
      const opts = h.capture.find((o) => o.shopId === shopId);
      const binding = opts.getDocumentBinding();
      const connection = { webContents: opts.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-" + shopId, url: "https://example.invalid/plateau/chat/latest_conversations" };
      opts.onHttpRequest({ connection, method: "POST", url: connection.url });
      opts.onHttpResponse({ binding: { connection, method: "POST", url: connection.url }, status: 200, mimeType: "application/json", body: bodyA });
      results.push(shopId);
    }
    assert.equal(h.collected.length, 4, "two messages per shop, kept separate");
    const stores = h.collected.map((e) => e.identityLock.storeId.value);
    assert.deepEqual(stores, ["store-shop-a", "store-shop-a", "store-shop-b", "store-shop-b"]);
  } finally { h.service.disposeAll(); }
});

test("HTTP wiring: multiple records map individually without selected-customer dependence", async () => {
  const h = makeService();
  try {
    const shopId = "shop-a";
    await activateReady(h.service, shopId);
    const opts = h.capture[0];
    const binding = opts.getDocumentBinding();
    const connection = { webContents: opts.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-multi", url: "https://example.invalid/plateau/chat/latest_conversations" };
    opts.onHttpRequest({ connection, method: "POST", url: connection.url });
    opts.onHttpResponse({ binding: { connection, method: "POST", url: connection.url }, status: 200, mimeType: "application/json", body: JSON.stringify(sample.latest_conversations_multi_conversation) });
    assert.equal(h.collected.length, 2);
    const uids = h.collected.map((e) => e.identityLock.platformCustomerId.value.value);
    assert.deepEqual(uids, ["800000001", "800000002"]);
  } finally { h.service.disposeAll(); }
});

test("HTTP wiring: same conversation with different client_msg_id is not split", async () => {
  const h = makeService();
  try {
    const shopId = "shop-a";
    await activateReady(h.service, shopId);
    const opts = h.capture[0];
    const binding = opts.getDocumentBinding();
    const mk = (msgId, clientId) => ({
      from: { role: "user", uid: "800000001" }, to: { role: "mall_cs", uid: "900000001" },
      content: "msg-" + msgId, ts: "1700000100", msg_id: msgId, client_msg_id: clientId,
    });
    const payload = { success: true, result: { conversations: [mk("1700000000100", "c-1"), mk("1700000000101", "c-2")] } };
    const connection = { webContents: opts.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-client", url: "https://example.invalid/plateau/chat/latest_conversations" };
    opts.onHttpRequest({ connection, method: "POST", url: connection.url });
    opts.onHttpResponse({ binding: { connection, method: "POST", url: connection.url }, status: 200, mimeType: "application/json", body: JSON.stringify(payload) });
    assert.equal(h.collected.length, 2, "both messages collected");
    const convs = h.collected.map((e) => e.identityLock.internalConversationId.value);
    assert.deepEqual(convs, ["conversation-shop-a", "conversation-shop-a"], "client_msg_id never splits the conversation");
  } finally { h.service.disposeAll(); }
});

test("HTTP wiring: unbound response, wrong CDP session, bad status and agent direction produce nothing", async () => {
  const h = makeService();
  try {
    const shopId = "shop-a";
    await activateReady(h.service, shopId);
    const opts = h.capture[0];
    const binding = opts.getDocumentBinding();
    const base = { webContents: opts.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: binding.sessionId, shopId, documentGeneration: binding.documentGeneration, cdpSessionId: "", requestId: "req-x", url: "https://example.invalid/plateau/chat/latest_conversations" };
    const body = JSON.stringify(sample.latest_conversations_customer_inbound);
    // 1) response with no request start
    opts.onHttpResponse({ binding: { connection: base, method: "POST", url: base.url }, status: 200, mimeType: "application/json", body });
    assert.equal(h.collected.length, 0, "unbound response rejected");
    // 2) wrong CDP sessionId cannot reuse the binding
    opts.onHttpRequest({ connection: base, method: "POST", url: base.url });
    opts.onHttpResponse({ binding: { connection: { ...base, cdpSessionId: "other" }, method: "POST", url: base.url }, status: 200, mimeType: "application/json", body });
    assert.equal(h.collected.length, 0, "wrong cdpSessionId rejected");
    // 3) non-2xx status
    opts.onHttpRequest({ connection: base, method: "POST", url: base.url });
    opts.onHttpResponse({ binding: { connection: base, method: "POST", url: base.url }, status: 500, mimeType: "application/json", body });
    assert.equal(h.collected.length, 0, "non-2xx rejected");
    // 4) agent-authored only
    opts.onHttpRequest({ connection: base, method: "POST", url: base.url });
    opts.onHttpResponse({ binding: { connection: base, method: "POST", url: base.url }, status: 200, mimeType: "application/json", body: JSON.stringify(sample.latest_conversations_agent_message) });
    assert.equal(h.collected.length, 0, "agent message never enters inbound");
    // 5) malformed body
    opts.onHttpRequest({ connection: base, method: "POST", url: base.url });
    opts.onHttpResponse({ binding: { connection: base, method: "POST", url: base.url }, status: 200, mimeType: "application/json", body: "{not json" });
    assert.equal(h.collected.length, 0, "malformed body rejected");
    assert.equal(h.legacy.length, 0, "no legacy fallback anywhere");
  } finally { h.service.disposeAll(); }
});

test("HTTP wiring: cross-shop binding and revoked admission are refused", async () => {
  const h = makeService();
  try {
    await activateReady(h.service, "shop-a");
    await activateReady(h.service, "shop-b");
    const optsA = h.capture.find((o) => o.shopId === "shop-a");
    const bindingA = optsA.getDocumentBinding();
    const shopBContents = h.service.webContentsFor("shop-b");
    const body = JSON.stringify(sample.latest_conversations_customer_inbound);
    // webContents of shop-b presented with shop-a's binding
    const cross = { webContents: shopBContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: bindingA.sessionId, shopId: "shop-a", documentGeneration: bindingA.documentGeneration, cdpSessionId: "", requestId: "req-cross", url: "https://example.invalid/plateau/chat/latest_conversations" };
    optsA.onHttpRequest({ connection: cross, method: "POST", url: cross.url });
    optsA.onHttpResponse({ binding: { connection: cross, method: "POST", url: cross.url }, status: 200, mimeType: "application/json", body });
    assert.equal(h.collected.length, 0, "cross-webContents binding refused");
    h.service.revokeMainAdmissionsForShop("shop-a");
    const optsA2 = h.capture.find((o) => o.shopId === "shop-a");
    const b2 = optsA2.getDocumentBinding();
    const conn = { webContents: optsA2.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: b2.sessionId, shopId: "shop-a", documentGeneration: b2.documentGeneration, cdpSessionId: "", requestId: "req-rev", url: "https://example.invalid/plateau/chat/latest_conversations" };
    optsA2.onHttpRequest({ connection: conn, method: "POST", url: conn.url });
    optsA2.onHttpResponse({ binding: { connection: conn, method: "POST", url: conn.url }, status: 200, mimeType: "application/json", body });
    assert.equal(h.collected.length, 0, "revoked admission blocks the HTTP path");
  } finally { h.service.disposeAll(); }
});

test("HTTP wiring: HTTP observation stays disabled when no allowlist is supplied", async () => {
  const h = makeService({ allowedInboundHttpRequest: undefined, decodeInboundHttpBody: undefined });
  try {
    await activateReady(h.service, "shop-a");
    const opts = h.capture[0];
    assert.equal(opts.allowedHttpRequest, undefined, "no HTTP allowlist -> observer gets none");
    assert.equal(h.collected.length, 0);
  } finally { h.service.disposeAll(); }
});
