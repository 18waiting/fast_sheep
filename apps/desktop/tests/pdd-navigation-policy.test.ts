import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyPddNavigation,
  interactionPolicyForRoute,
  isPddNavigationAllowed,
  isPddPopupAllowed,
  PDD_PRODUCTION_CHAT_URL,
  PDD_TOP_LEVEL_HOST,
} from "../dist/main/platforms/pdd/pdd-navigation-policy.js";
import { PddPreloadBridge } from "../dist/main/platforms/pdd/pdd-preload-bridge.js";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { PddViewHost } from "../dist/main/platforms/pdd/pdd-view-host.js";

const PRODUCTION = { navigationMode: "PRODUCTION_READ_ONLY" as const, allowedProductionHosts: [PDD_TOP_LEVEL_HOST] };
const FIXTURE = { navigationMode: "FIXTURE" as const };
const HERE = dirname(fileURLToPath(import.meta.url));

test("fixture mode allows only local file routes and production URLs stay unavailable", () => {
  assert.equal(classifyPddNavigation("file:///C:/fixture/chat-basic.html", FIXTURE), "FIXTURE");
  assert.equal(classifyPddNavigation(PDD_PRODUCTION_CHAT_URL, FIXTURE), "BLOCKED");
  assert.equal(classifyPddNavigation("http://evil.example", FIXTURE), "BLOCKED");
});

test("production read-only route policy is exact and fails closed", () => {
  assert.equal(classifyPddNavigation("https://mms.pinduoduo.com/login/", PRODUCTION), "LOGIN");
  assert.equal(classifyPddNavigation(PDD_PRODUCTION_CHAT_URL, PRODUCTION), "CHAT");
  assert.equal(classifyPddNavigation("https://mms.pinduoduo.com/chat/", PRODUCTION), "BLOCKED");
  assert.equal(classifyPddNavigation("https://mms.pinduoduo.com/other", PRODUCTION), "BLOCKED");
  assert.equal(classifyPddNavigation("http://mms.pinduoduo.com/chat-merchant/index.html", PRODUCTION), "BLOCKED");
  assert.equal(classifyPddNavigation("https://other.example/chat-merchant/index.html", PRODUCTION), "BLOCKED");
  assert.equal(classifyPddNavigation(PDD_PRODUCTION_CHAT_URL, { navigationMode: "PRODUCTION_READ_ONLY", allowedProductionHosts: [] }), "BLOCKED");
});

test("query strings and fragments do not affect route identity", () => {
  assert.equal(classifyPddNavigation(PDD_PRODUCTION_CHAT_URL + "?cache=1#fragment", PRODUCTION), "CHAT");
  assert.equal(classifyPddNavigation("https://mms.pinduoduo.com/login/?next=chat#x", PRODUCTION), "LOGIN");
});

test("redirect policy uses the same exact route classifier", () => {
  assert.equal(isPddNavigationAllowed("https://mms.pinduoduo.com/login/", PRODUCTION), true);
  assert.equal(isPddNavigationAllowed(PDD_PRODUCTION_CHAT_URL + "?redirect=1", PRODUCTION), true);
  assert.equal(isPddNavigationAllowed("https://mms.pinduoduo.com/unknown", PRODUCTION), false);
  assert.equal(isPddNavigationAllowed("https://evil.example/chat-merchant/index.html", PRODUCTION), false);
});

test("popups remain denied by default", () => {
  assert.equal(isPddPopupAllowed("https://evil.example", PRODUCTION), false);
  assert.equal(isPddPopupAllowed(PDD_PRODUCTION_CHAT_URL, PRODUCTION), false);
});

test("login is interactive while chat and blocked routes suppress input and mutation", () => {
  assert.deepEqual(interactionPolicyForRoute("LOGIN"), { pointerInputEnabled: true, keyboardInputEnabled: true, mutationCommandsEnabled: false });
  assert.deepEqual(interactionPolicyForRoute("CHAT"), { pointerInputEnabled: false, keyboardInputEnabled: false, mutationCommandsEnabled: false });
  assert.deepEqual(interactionPolicyForRoute("BLOCKED"), { pointerInputEnabled: false, keyboardInputEnabled: false, mutationCommandsEnabled: false });
});

test("preload bridge blocks mutation commands in navigation-only mode but keeps scan available", async () => {
  const sent: unknown[] = [];
  const view = { webContents: { send: (_channel: string, payload: unknown) => sent.push(payload), isDestroyed: () => false } };
  const bridge = new PddPreloadBridge(view as never, 100);
  bridge.setMutationCommandsEnabled(false);

  const denied = await bridge.execute({ type: "send_text", command_id: "m1", session_id: "s1", conversation_id: "c1", text: "x" });
  assert.deepEqual(denied, { command_id: "m1", ok: false, error: "platform.command_disabled_navigation_only" });
  assert.equal(sent.length, 0);

  const pending = bridge.execute({ type: "scan", command_id: "scan-1", session_id: "s1" });
  assert.equal(sent.length, 1);
  bridge.resolveResult({ command_id: "scan-1", ok: true, result: { messages: [] } });
  assert.equal((await pending).ok, true);
});

test("production view-host source exposes loadURL and host-level input suppression", () => {
  const source = readFileSync(join(HERE, "..", "src", "main", "platforms", "pdd", "pdd-view-host.ts"), "utf-8");
  assert.ok(source.includes(".loadURL(url)"));
  assert.ok(source.includes("before-mouse-event"));
  assert.ok(source.includes("before-input-event"));
  assert.ok(source.includes("will-redirect"));
});

test("production read-only service loads the exact entry URL, never a fixture, and binds no send adapter", async () => {
  const loaded: string[] = [];
  let fixtureLoads = 0;
  const fakeView = {
    visible: false,
    webContents: { send: () => {}, isDestroyed: () => false },
    loadLocalFixture: async () => { fixtureLoads++; },
    loadProductionEntry: async (url: string) => { loaded.push(url); },
    setRouteDecisionHandler: () => {},
    setDocumentLifecycleObserver: () => {},
    startDocumentObservation: () => {},
    show: () => {}, hide: () => {}, setBounds: () => {}, dispose: () => {},
    get isVisible() { return this.visible; },
  };
  const service = new PddPlatformService({
    testMode: false,
    navigationMode: "PRODUCTION_READ_ONLY",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: () => { throw new Error("production mode must not request a fixture"); },
    makeView: () => fakeView as never,
    productionEntryUrl: PDD_PRODUCTION_CHAT_URL,
    revision: () => 1,
  });
  await service.activate("shop-1");
  assert.deepEqual(loaded, [PDD_PRODUCTION_CHAT_URL]);
  assert.equal(fixtureLoads, 0);
  assert.equal(service.adapterFor("shop-1"), null);
  const routed = await service.routingAdapter().sendText("shop-1", "c1", ["x"]);
  assert.deepEqual(routed, { ok: false, error: "platform.command_disabled_navigation_only" });
});

test("login to chat transition activates shield and input suppression before navigation proceeds", () => {
  const listeners = new Map<string, Array<(...args: never[]) => void>>();
  const mainBounds: Array<Record<string, number | boolean>> = [];
  const shieldBounds: Array<Record<string, number | boolean>> = [];
  const makeContents = (name: string) => ({
    send: () => {},
    isDestroyed: () => false,
    close: () => {},
    setWindowOpenHandler: () => {},
    on: (event: string, listener: (...args: never[]) => void) => {
      const key = name + ":" + event;
      listeners.set(key, [...(listeners.get(key) ?? []), listener]);
    },
    session: { setPermissionRequestHandler: () => {} },
    loadURL: async () => {},
    loadFile: async () => {},
  });
  const main = makeContents("main");
  const shield = makeContents("shield");
  const fakeView = (contents: ReturnType<typeof makeContents>, bounds: Array<Record<string, number | boolean>>) => ({
    webContents: contents,
    setBackgroundColor: () => {},
    setBounds: (value: Record<string, number | boolean>) => bounds.push(value),
    setVisible: () => {},
  });
  const attached: string[] = [];
  const host = new PddViewHost({
    shopId: "shop-1",
    navigationMode: "PRODUCTION_READ_ONLY",
    allowedProductionHosts: [PDD_TOP_LEVEL_HOST],
    productionEntryUrl: PDD_PRODUCTION_CHAT_URL,
    createView: () => fakeView(main, mainBounds) as never,
    createShieldView: () => fakeView(shield, shieldBounds) as never,
    attachViews: (pdd, shieldView) => {
      attached.push("pdd", "shield");
      return { removeChildView: () => { void pdd; void shieldView; } };
    },
  });
  host.show();
  host.setBounds({ x: 10, y: 20, width: 300, height: 200, visible: true }, { x: 0, y: 0, width: 1000, height: 800 });

  const loginEvent = { preventDefault: () => { throw new Error("login redirect must be allowed"); } };
  for (const listener of listeners.get("main:will-redirect") ?? []) listener(loginEvent as never, "https://mms.pinduoduo.com/login/" as never, false as never, true as never);
  assert.equal(host.currentRouteKind, "LOGIN");
  assert.equal(host.isReadOnlyInteractionActive, false);
  assert.equal(host.mutationCommandsEnabled, false);

  const chatEvent = { preventDefault: () => { throw new Error("chat redirect must be allowed"); } };
  for (const listener of listeners.get("main:will-redirect") ?? []) listener(chatEvent as never, PDD_PRODUCTION_CHAT_URL as never, false as never, true as never);
  assert.equal(host.currentRouteKind, "CHAT");
  assert.equal(host.isReadOnlyInteractionActive, true);
  assert.equal(host.mutationCommandsEnabled, false);
  assert.deepEqual(attached, ["pdd", "shield"]);

  host.setBounds({ x: 500, y: 400, width: 300, height: 200, visible: true }, { x: 0, y: 0, width: 1000, height: 800 });
  assert.deepEqual(shieldBounds[0], { x: 10, y: 20, width: 300, height: 200, visible: true });
  assert.deepEqual(shieldBounds[1], { x: 10, y: 20, width: 790, height: 580, visible: true });
  assert.deepEqual(mainBounds.at(-1), { x: 500, y: 400, width: 300, height: 200, visible: true });
});
