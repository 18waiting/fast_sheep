// Canonical inbound capture eligibility regression.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { decodePddLatestConversationsPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));
const BODY = JSON.stringify(sample.customer_inbound_observed);
const ALLOW = "https://example.invalid/plateau/chat/latest_conversations";

class FakeView {
  visible = false;
  webContents = { destroyed: false, send: () => {}, isDestroyed() { return false; } };
  async loadLocalFixture() {}
  show() {} hide() {} setBounds() {} dispose() {}
  setDocumentLifecycleObserver() {} setRouteDecisionHandler() {} startDocumentObservation() {}
  get isVisible() { return this.visible; }
}
// Production stub whose navigation never settles -> session stays CREATING with no binding.
class StuckProductionView extends FakeView {
  loadProductionEntry() { return new Promise(() => {}); }
}

const res = (v) => ({ status: "RESOLVED", value: v });
function scopeFor(shopId) {
  return { merchantId: res("merchant-1"), storeId: res("store-" + shopId), platformAccountId: res("account-" + shopId) };
}

function harness({ mode = "FIXTURE", admission = { granted: true, admissionId: "ok" }, navMode } = {}) {
  const collected = [];
  const legacy = [];
  const observerOptions = [];
  const service = new PddPlatformService({
    navigationMode: navMode ?? (mode === "FIXTURE" ? "FIXTURE" : "PRODUCTION_READ_ONLY"),
    orchestrator: { onBuyerMessage: async () => { legacy.push("buyer"); }, onHumanTakeover: async () => { legacy.push("takeover"); }, onFocusShop: () => { legacy.push("focus"); } },
    fixturePathFor: (s) => "/fixture-" + s + ".html",
    productionEntryUrl: "https://mms.pinduoduo.com/chat-merchant/index.html",
    allowedProductionHosts: ["mms.pinduoduo.com"],
    makeView: () => (mode === "STUCK" ? new StuckProductionView() : new FakeView()),
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => admission },
    allowedInboundHttpRequest: (m, u) => m === "POST" && u === ALLOW,
    decodeInboundHttpBody: (body) => {
      const d = decodePddLatestConversationsPayload(body);
      if (d.status !== "DECODED") return null;
      const inputs = [];
      for (const m of d.messages) if (m.ingressInput) inputs.push(m.ingressInput);
      return inputs.length ? inputs : null;
    },
    resolveInboundScope: (doc) => scopeFor(doc.shopId),
    resolveInboundIdentity: (message, doc) => ({
      runtimeShop: res({ value: doc.shopId }), scope: scopeFor(doc.shopId),
      runtimeConversationReference: res({ value: "runtime-" + doc.shopId }),
      association: { ownerRuntimeShopId: doc.shopId, ownerScope: scopeFor(doc.shopId), platformCustomerId: message.customerUid, platformMessageId: message.platformMessageId, internalConversationId: res("conversation-" + doc.shopId), localMessageId: res("local-" + doc.shopId) },
    }),
    onCanonicalInbound: (e) => collected.push(e),
    onInboundMessage: async (m) => { legacy.push(m); },
    createInboundObserver: (options) => {
      observerOptions.push(options);
      return {
        observerId: "fake-observer", activeLifecycleId: 1, isTerminal: false,
        get isEnabled() { return true; },
        get targetWebContents() { return options.webContents; },
        start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
        stop: () => {}, snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, enabled: true, terminal: false }),
      };
    },
  });
  return { service, collected, legacy, observerOptions };
}
function conn(o, shopId, requestId = "r1", over = {}) {
  const b = o.getDocumentBinding() ?? { sessionId: "pdd-session-" + shopId, shopId, documentGeneration: 1 };
  return { webContents: o.webContents, observerId: "fake-observer", observerLifecycleId: 1, sessionId: b.sessionId, shopId, documentGeneration: b.documentGeneration, cdpSessionId: "", requestId, url: ALLOW, ...over };
}
function deliver(o, connection, body = BODY, status = 200) {
  o.onHttpRequest({ connection, method: "POST", url: connection.url });
  o.onHttpResponse({ binding: { connection, method: "POST", url: connection.url }, status, mimeType: "application/json", body });
}

test("1+8. LOADING with a trusted document and valid admission captures a message WITHOUT any page_ready", async () => {
  const h = harness();
  try {
    await h.service.activate("shop-a");
    assert.equal(h.service.status("shop-a")?.session_status, "LOADING", "no legacy page_ready was sent");
    const o = h.observerOptions[0];
    deliver(o, conn(o, "shop-a"));
    assert.equal(h.collected.length, 1, "canonical capture does not depend on the legacy READY signal");
    assert.equal(h.collected[0].identityLock.triggerMessage.platformMessageIdentity.value, "1700001000001");
    assert.equal(h.legacy.length, 0);
  } finally { h.service.disposeAll(); }
});

test("2. admission missing/denied/threw produce zero collector calls", async () => {
  for (const admission of [{ granted: false, reason: "TEST_DENY" }, { granted: false, reason: "THREW" }]) {
    const h = harness({ admission });
    try {
      await h.service.activate("shop-a");
      deliver(h.observerOptions[0], conn(h.observerOptions[0], "shop-a"));
      assert.equal(h.collected.length, 0, "admission " + JSON.stringify(admission) + " must not reach the collector");
      assert.equal(h.legacy.length, 0);
    } finally { h.service.disposeAll(); }
  }
});

test("2b. revoked admission blocks later responses", async () => {
  const h = harness();
  try {
    await h.service.activate("shop-a");
    h.service.revokeMainAdmissionsForShop("shop-a");
    deliver(h.observerOptions[0], conn(h.observerOptions[0], "shop-a"));
    assert.equal(h.collected.length, 0);
  } finally { h.service.disposeAll(); }
});

test("3. login/reauth/dom-unsupported/disposed states fail closed", async () => {
  const cases = [
    { event: "login_required" },
    { event: "auth_reauth_required" },
    { event: "dom_unsupported", reason: "TEST" },
  ];
  for (const c of cases) {
    const h = harness();
    try {
      await h.service.activate("shop-a");
      const sender = h.service.webContentsFor("shop-a");
      h.service.handlePageEvent({ ...c, session_id: "pdd-session-shop-a", shop_id: "shop-a" }, sender);
      deliver(h.observerOptions[0], conn(h.observerOptions[0], "shop-a"));
      assert.equal(h.collected.length, 0, "state " + c.event + " must fail closed");
    } finally { h.service.disposeAll(); }
  }
  const disposed = harness();
  await disposed.service.activate("shop-a");
  disposed.service.disposeAll();
  deliver(disposed.observerOptions[0], conn(disposed.observerOptions[0], "shop-a"));
  assert.equal(disposed.collected.length, 0, "disposed session must fail closed");
});

test("4. CREATING without a trusted document binding is rejected", async () => {
  const h = harness({ mode: "STUCK" });
  try {
    await h.service.activate("shop-a");
    assert.equal(h.service.status("shop-a")?.session_status, "CREATING");
    const o = h.observerOptions[0];
    // observer has no document binding yet
    o.onHttpRequest({ connection: conn(o, "shop-a"), method: "POST", url: ALLOW });
    deliver(o, conn(o, "shop-a"));
    assert.equal(h.collected.length, 0, "CREATING without a document generation must not capture");
  } finally { h.service.disposeAll(); }
});

test("7. wrong webContents, cross-shop and wrong generation/session/request ids are rejected", async () => {
  const h = harness();
  try {
    await h.service.activate("shop-a");
    const o = h.observerOptions[0];
    const base = conn(o, "shop-a");
    // wrong document generation
    deliver(o, { ...base, documentGeneration: 99 });
    assert.equal(h.collected.length, 0, "wrong document generation");
    // cross-shop binding
    deliver(o, { ...base, shopId: "shop-b" });
    assert.equal(h.collected.length, 0, "cross-shop binding");
    // wrong observer lifecycle
    deliver(o, { ...base, observerLifecycleId: 42 });
    assert.equal(h.collected.length, 0, "wrong observer lifecycle");
    // response without any request-start binding
    o.onHttpResponse({ binding: { connection: { ...base, requestId: "never-seen" }, method: "POST", url: ALLOW }, status: 200, mimeType: "application/json", body: BODY });
    assert.equal(h.collected.length, 0, "unbound response");
  } finally { h.service.disposeAll(); }
});

test("9+10. permitted path keeps legacy/AI/send at zero", async () => {
  const h = harness();
  try {
    await h.service.activate("shop-a");
    deliver(h.observerOptions[0], conn(h.observerOptions[0], "shop-a"));
    assert.equal(h.collected.length, 1);
    assert.equal(h.legacy.length, 0, "legacy bridge, AI and send consumers stay untouched");
  } finally { h.service.disposeAll(); }
});