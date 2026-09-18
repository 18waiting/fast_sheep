import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";

const res = (v) => ({ status: "RESOLVED", value: v });
const scopeObj = () => ({ merchantId: res("m"), storeId: res("s"), platformAccountId: res("a") });

function makeFakeView(overrides = {}) {
  const wc = {
    send: () => {}, isDestroyed: () => false, setWindowOpenHandler: () => {}, on: () => {},
    executeJavaScript: async () => undefined, loadURL: async () => {},
  };
  return {
    webContents: wc, visible: false,
    loadLocalFixture: async () => {}, loadProductionEntry: async () => {},
    setRouteDecisionHandler: () => {}, setDocumentLifecycleObserver: () => {}, startDocumentObservation: () => {},
    show() {}, hide() {}, setBounds() {}, dispose() {},
    get isVisible() { return this.visible; },
    ...overrides,
  };
}

function makeService(view, observerOverrides = {}) {
  const service = new PddPlatformService({
    navigationMode: "PRODUCTION_READ_ONLY",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined },
    allowedProductionHosts: ["mms.pinduoduo.com"],
    productionEntryUrl: "https://mms.pinduoduo.com/chat-merchant/index.html",
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => ({ granted: true, admissionId: "a" }) },
    allowedInboundHttpRequest: () => true,
    decodeInboundHttpBody: () => null,
    resolveInboundScope: () => scopeObj(),
    resolveInboundIdentity: () => null,
    makeView: () => view,
    createInboundObserver: (options) => ({
      observerId: "fake", activeLifecycleId: 1, isTerminal: false,
      get targetWebContents() { return options.webContents; },
      start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
      stop: () => undefined,
      snapshot: () => ({ observerId: "fake", lifecycleId: 1, enabled: true, terminal: false }),
      ...observerOverrides,
    }),
  });
  return { service };
}

test("redirect-aborted entry navigation does not wedge activate", async () => {
  const view = makeFakeView({ loadProductionEntry: () => Promise.reject(Object.assign(new Error("ERR_ABORTED (-3)"), { code: "ERR_ABORTED" })) });
  const { service } = makeService(view);
  await service.activate("shop-1");
  assert.equal(service.status("shop-1")?.session_status, "CREATING");
  service.disposeAll();
});

test("genuine navigation failure still fails closed", async () => {
  const view = makeFakeView({ loadProductionEntry: () => Promise.reject(Object.assign(new Error("net::ERR_NAME_NOT_RESOLVED"), { code: "ERR_NAME_NOT_RESOLVED" })) });
  const { service } = makeService(view);
  await assert.rejects(service.activate("shop-1"), /ERR_NAME_NOT_RESOLVED/);
  service.disposeAll();
});

test("observer enable failure still fails closed", async () => {
  const view = makeFakeView();
  const { service } = makeService(view, { start: () => ({ lifecycleId: 1, enablePromise: Promise.reject(new Error("NETWORK_ENABLE_FAILED")) }) });
  await assert.rejects(service.activate("shop-1"), /NETWORK_ENABLE_FAILED/);
  service.disposeAll();
});

test("navigation that never settles does not block activate indefinitely", async () => {
  const view = makeFakeView({ loadProductionEntry: () => new Promise(() => {}) });
  const { service } = makeService(view);
  const started = Date.now();
  await service.activate("shop-1");
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 8000, "bounded navigation window (actual " + elapsed + "ms)");
  service.disposeAll();
});
