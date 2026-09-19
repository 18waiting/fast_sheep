import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { createMainContext } from "../dist/main/bootstrap.js";

class FakeView {
  visible = false;
  webContents: { destroyed: boolean; send(): void; isDestroyed(): boolean };
  constructor() {
    const wc = { destroyed: false, send: () => {} };
    wc.isDestroyed = () => wc.destroyed;
    this.webContents = wc;
  }
  async loadLocalFixture(): Promise<void> {}
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(): void {}
  dispose(): void { this.webContents.destroyed = true; }
  setDocumentLifecycleObserver(): void {}
  startDocumentObservation(): void {}
  get isVisible(): boolean { return this.visible; }
}

function resolution(value: unknown) {
  return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value };
}
const scope = () => ({
  merchantId: resolution("merchant-1"),
  storeId: resolution("store-1"),
  platformAccountId: resolution("account-1"),
});

function makeService(mode: "DISABLED" | "CANONICAL_CONTROLLED" | "LEGACY", provider = { evaluate: () => ({ granted: false, reason: "TEST_DENY" }) }) {
  const collected = [];
  const legacy = [];
  let captured;
  const views = new Map();
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: (shopId) => "/fixture-" + shopId + ".html",
    makeView: (shopId: string) => { const view = new FakeView(); views.set(shopId, view); return view as never; },
    canonicalIngressMode: mode,
    mainAdmissionProvider: provider as never,
    decodeInboundFrame: (payloadData) => {
      const parsed = JSON.parse(payloadData);
      return { payload: parsed.payload, sourceOccurredAt: parsed.sourceOccurredAt };
    },
    allowedInboundWebSocketUrl: () => true,
    createInboundObserver: ((options: unknown) => {
      captured = options as never;
      return {
        observerId: "fake-observer",
        activeLifecycleId: 1,
        isTerminal: false,
        get isEnabled() { return true; },
        get targetWebContents() { return (options as { webContents: unknown }).webContents; },
        start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
        stop: () => undefined,
        snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, terminal: false }),
      } as never;
    }) as never,
    resolveInboundScope: () => scope(),
    resolveInboundIdentity: (message: { customerUid?: string; platformMessageId?: string }, document: { shopId: string }) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: scope(),
      runtimeConversationReference: resolution({ value: "runtime-" + document.shopId }),
      association: message.customerUid === undefined || message.platformMessageId === undefined ? undefined : {
        ownerRuntimeShopId: document.shopId,
        ownerScope: scope(),
        platformCustomerId: message.customerUid,
        platformMessageId: message.platformMessageId,
        internalConversationId: resolution("conversation-1"),
        localMessageId: resolution("local-message-1"),
      },
    }),
    onInboundMessage: async (message) => { legacy.push(message); },
    onCanonicalInbound: (envelope) => { collected.push(envelope); },
  });
  return { service, collected, legacy, views, captured: () => captured };
}

function payload(content = "controlled") {
  return JSON.stringify({ payload: { content, from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "m-1" }, sourceOccurredAt: "2026-09-18T00:00:00Z" });
}

test("default production-facing mode is DISABLED and legacy consumers are blocked", async () => {
  const h = makeService("DISABLED");
  await h.service.activate("shop-a");
  const sender = h.service.webContentsFor("shop-a");
  assert.ok(sender);
  h.service.handlePageEvent({ event: "message_received", session_id: "pdd-session-shop-a", shop_id: "shop-a", conversation_id: "c1", content: "legacy" } as never, sender);
  assert.equal(h.legacy.length, 0);
  assert.equal(h.collected.length, 0);
  assert.equal(h.service.inboundDiagnostics().mode, "DISABLED");
});

test("controlled wiring drops pre-admission frames and requires Main admission", async () => {
  let admitted = false;
  const h = makeService("CANONICAL_CONTROLLED", { evaluate: () => admitted ? { granted: true, admissionId: "ignored" } : { granted: false, reason: "TEST_DENY" } } as never);
  await h.service.activate("shop-a");
  const options = h.captured() as {
    webContents: unknown; onConnection(connection: unknown): void; onFrame(frame: unknown): void;
  };
  const sender = h.service.webContentsFor("shop-a")!;
  const binding = { sessionId: "pdd-session-shop-a", shopId: "shop-a", documentGeneration: 1 };
  const connection = {
    webContents: sender,
    observerId: "fake-observer",
    observerLifecycleId: 1,
    sessionId: binding.sessionId,
    shopId: binding.shopId,
    documentGeneration: binding.documentGeneration,
    cdpSessionId: "",
    requestId: "request-1",
    url: "ws://127.0.0.1/socket",
  };
  options.onConnection(connection);
  options.onFrame({ connection, cdpSessionId: "", requestId: "request-1", payloadData: payload(), opcode: 1 });
  assert.equal(h.collected.length, 0, "pre-READY frame is dropped");
  h.service.handlePageEvent({ event: "page_ready", session_id: binding.sessionId, shop_id: binding.shopId } as never, sender);
  options.onFrame({ connection, cdpSessionId: "", requestId: "request-1", payloadData: payload(), opcode: 1 });
  assert.equal(h.collected.length, 0, "denied admission is fail-closed");
  assert.ok(Object.keys(h.service.inboundDiagnostics().decisions as object).some((key) => key.startsWith("MAIN_ADMISSION_DENIED")));
  admitted = true;
  options.onFrame({ connection, cdpSessionId: "", requestId: "request-1", payloadData: payload(), opcode: 1 });
  assert.equal(h.collected.length, 1);
});

test("frames without recorded connection evidence are rejected", async () => {
  const h = makeService("CANONICAL_CONTROLLED", { evaluate: () => ({ granted: true, admissionId: "ignored" }) } as never);
  await h.service.activate("shop-a");
  const options = h.captured() as { onFrame(frame: unknown): void };
  const sender = h.service.webContentsFor("shop-a")!;
  options.onFrame({
    connection: {
      webContents: sender,
      observerId: "fake-observer",
      observerLifecycleId: 1,
      sessionId: "pdd-session-shop-a",
      shopId: "shop-a",
      documentGeneration: 1,
      cdpSessionId: "",
      requestId: "not-recorded",
      url: "ws://127.0.0.1/socket",
    },
    cdpSessionId: "",
    requestId: "not-recorded",
    payloadData: payload(),
    opcode: 1,
  });
  assert.equal(h.collected.length, 0);
  assert.ok(Object.keys(h.service.inboundDiagnostics().decisions as object).includes("UNBOUND_CONNECTION"));
});

test("Main bootstrap passes explicit canonical ingress mode into PddPlatformService", () => {
  const disabled = createMainContext({ testMode: true, canonicalIngressMode: "DISABLED" });
  const controlled = createMainContext({ testMode: true, canonicalIngressMode: "CANONICAL_CONTROLLED" });
  assert.equal(disabled.platform.inboundDiagnostics().mode, "DISABLED");
  assert.equal(controlled.platform.inboundDiagnostics().mode, "CANONICAL_CONTROLLED");
});

test("observer enable failure disposes the session and does not fall back legacy", async () => {
  let legacy = 0;
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: () => "/fixture.html",
    makeView: () => new FakeView() as never,
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    allowedInboundWebSocketUrl: () => true,
    decodeInboundFrame: () => null,
    createInboundObserver: ((options: { webContents: unknown }) => ({
      observerId: "failing-observer",
      activeLifecycleId: 1,
      isTerminal: false,
      get isEnabled() { return true; },
      targetWebContents: options.webContents,
      start: () => ({ lifecycleId: 1, enablePromise: Promise.reject(new Error("enable-fail")) }),
      stop: () => undefined,
      snapshot: () => ({ observerId: "failing-observer", lifecycleId: 1, terminal: false }),
    })) as never,
    onInboundMessage: async () => { legacy += 1; },
  });
  await assert.rejects(service.activate("shop-a"), /enable-fail/);
  assert.equal(service.status("shop-a"), null);
  assert.equal(legacy, 0);
});

test("attach failure disposes the session and does not fall back legacy", async () => {
  let legacy = 0;
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: () => "/fixture.html",
    makeView: () => new FakeView() as never,
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    allowedInboundWebSocketUrl: () => true,
    decodeInboundFrame: () => null,
    createInboundObserver: ((options: { webContents: unknown }) => ({
      observerId: "attach-failing-observer",
      activeLifecycleId: 1,
      isTerminal: false,
      get isEnabled() { return true; },
      targetWebContents: options.webContents,
      start: () => { throw new Error("attach-fail"); },
      stop: () => undefined,
      snapshot: () => ({ observerId: "attach-failing-observer", lifecycleId: 1, terminal: false }),
    })) as never,
    onInboundMessage: async () => { legacy += 1; },
  });
  await assert.rejects(service.activate("shop-a"), /attach-fail/);
  assert.equal(service.status("shop-a"), null);
  assert.equal(legacy, 0);
});
