import { app, BrowserWindow, ipcMain } from "electron";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { PddPlatformService } from "../apps/desktop/dist/main/platforms/pdd/pdd-platform-service.js";
import { PddViewHost } from "../apps/desktop/dist/main/platforms/pdd/pdd-view-host.js";
import { BoundaryObserver } from "./fixtures/sheep-301-local-electron-websocket-boundary/observer.mjs";

const require = createRequire(import.meta.url);
const { WebSocketServer } = require("E:/fast_sheep/node_modules/.pnpm/ws@8.21.3/node_modules/ws");
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const FIXTURE_PATH = join(HERE, "fixtures", "sheep-301-local-electron-websocket-boundary", "fixture.html");
const TEMP_ROOT = "E:\\fast_sheep.tmp\\sheep-301-local-electron-websocket-boundary-proof";
const REPORT_PATH = join(REPO_ROOT, "reports", "SHEEP-301-local-electron-websocket-boundary-proof-report.json");
const BASELINE = "8fb05f70d264943447981d19aa71a1dd4618c2b5";

mkdirSync(TEMP_ROOT, { recursive: true });
app.setPath("userData", join(TEMP_ROOT, "user-data"));
app.setPath("sessionData", join(TEMP_ROOT, "session-data"));
app.setPath("cache", join(TEMP_ROOT, "cache"));
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");

const checks = [];
const failures = [];
const unhandledRejections = [];
process.on("unhandledRejection", (reason) => unhandledRejections.push(String(reason)));

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(label, predicate, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await delay(20);
  }
  throw new Error(`timeout waiting for ${label}`);
}
async function step(id, name, fn) {
  try {
    const evidence = await fn();
    checks.push({ id, name, status: "PASS", evidence: evidence ?? null });
    return evidence;
  } catch (error) {
    const failure = { id, name, status: "FAIL", error: String(error?.stack ?? error) };
    checks.push(failure); failures.push(failure); throw error;
  }
}
function resolution(value) { return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value }; }
function scopeFor(shopId) {
  return {
    merchantId: resolution(`merchant-${shopId}`),
    storeId: resolution(`store-${shopId}`),
    platformAccountId: resolution(`account-${shopId}`),
  };
}
function associationFor(shopId, message) {
  if (message.customerUid === undefined || message.platformMessageId === undefined) return undefined;
  const scope = scopeFor(shopId);
  if (message.content === "CROSS_OWNER_ASSOCIATION") {
    return {
      ownerRuntimeShopId: shopId === "shop-a" ? "shop-b" : "shop-a",
      ownerScope: scope,
      platformCustomerId: message.customerUid,
      platformMessageId: message.platformMessageId,
      internalConversationId: resolution(`owner-mismatch-conversation-${shopId}`),
      localMessageId: resolution(`owner-mismatch-local-${shopId}`),
    };
  }
  if (message.content === "CROSS_SCOPE_ASSOCIATION") {
    return {
      ownerRuntimeShopId: shopId,
      ownerScope: scopeFor(shopId === "shop-a" ? "shop-b" : "shop-a"),
      platformCustomerId: message.customerUid,
      platformMessageId: message.platformMessageId,
      internalConversationId: resolution(`foreign-conversation-${shopId}`),
      localMessageId: resolution(`foreign-local-${shopId}`),
    };
  }
  return {
    ownerRuntimeShopId: shopId,
    ownerScope: scope,
    platformCustomerId: message.customerUid,
    platformMessageId: message.platformMessageId,
    internalConversationId: resolution(`conversation-${shopId}`),
    localMessageId: resolution(`local-${shopId}`),
  };
}
function createStubOrchestrator(counters) {
  return {
    onBuyerMessage: async () => { counters.legacyBridgeCalls += 1; },
    onHumanTakeover: async () => { counters.legacyBridgeCalls += 1; },
    onFocusShop: () => { counters.legacyBridgeCalls += 1; },
  };
}

async function startWebSocketServer() {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  server.on("connection", (socket) => {
    socket.on("message", (data, isBinary) => {
      if (isBinary) { socket.send(Buffer.from("binary-fixture")); return; }
      let command;
      try { command = JSON.parse(data.toString()); } catch { return; }
      if (command?.kind !== "proof-command") return;
      if (command.binary) { socket.send(Buffer.from("binary-fixture")); return; }
      socket.send(JSON.stringify({ kind: "proof-frame", payload: command.payload, sourceOccurredAt: command.sourceOccurredAt }));
    });
  });
  return { server, port: server.address().port };
}

function createHarness(port) {
  const hiddenWindow = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const observers = new Map();
  const collectorState = { envelopes: [], calls: 0, mode: "normal" };
  const counters = { legacyBridgeCalls: 0, aiCalls: 0, transportSendCalls: 0, businessPersistenceWrites: 0 };
  let service;
  const collector = (envelope) => {
    collectorState.calls += 1;
    if (collectorState.mode === "sync-throw") throw new Error("fixture-collector-sync-throw");
    if (collectorState.mode === "async-reject") return Promise.reject(new Error("fixture-collector-async-reject"));
    collectorState.envelopes.push(envelope);
    return undefined;
  };
  const makeView = (shopId) => {
    const view = new PddViewHost({ shopId, navigationMode: "FIXTURE" });
    const observer = new BoundaryObserver({
      webContents: view.webContents,
      shopId,
      allowedUrl: (url) => String(url).startsWith(`ws://127.0.0.1:${port}/`),
      getService: () => service,
    });
    observers.set(shopId, observer);
    observer.start();
    return view;
  };
  service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: createStubOrchestrator(counters),
    fixturePathFor: () => FIXTURE_PATH,
    makeView,
    resolveInboundScope: (document) => (document.shopId === "shop-a" || document.shopId === "shop-b") ? scopeFor(document.shopId) : null,
    resolveInboundIdentity: (message, document) => {
      const scope = scopeFor(document.shopId);
      return {
        runtimeShop: resolution({ value: document.shopId }),
        scope,
        runtimeConversationReference: resolution({ value: `runtime-${document.shopId}` }),
        association: associationFor(document.shopId, message),
        selectedCustomerObservation: { status: "SELECTED", platformCustomerId: { value: "999999" } },
      };
    },
    onCanonicalInbound: collector,
  });
  const pageEventListener = (event, payload) => {
    if (service.isTrustedPddWebContents(event.sender)) service.handlePageEvent(payload);
  };
  ipcMain.on("pdd-page-event", pageEventListener);

  async function activate(shopId) {
    await service.activate(shopId);
    const observer = observers.get(shopId);
    await observer.ready;
    await waitFor(`session ${shopId} READY`, () => service.status(shopId)?.session_status === "READY");
    await waitFor(`observer ${shopId} ready`, () => observer.enabled);
    return observer;
  }

  async function startSocket(shopId) {
    const webContents = service.webContentsFor(shopId);
    assert.ok(webContents, `missing webContents for ${shopId}`);
    const url = `ws://127.0.0.1:${port}/?shop=${encodeURIComponent(shopId)}`;
    await webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const ws = new WebSocket(${JSON.stringify(url)});
      window.__proofSocket = ws;
      ws.onopen = () => resolve(true);
      ws.onerror = () => reject(new Error("fixture websocket error"));
    })`, true);
    const observer = observers.get(shopId);
    await waitFor(`connection binding for ${shopId}`, () => observer.bindings.size > 0);
    return observer;
  }

  async function emit(shopId, payload, sourceOccurredAt) {
    const observer = observers.get(shopId);
    const before = observer.results.length;
    const command = { kind: "proof-command", payload, sourceOccurredAt };
    const webContents = service.webContentsFor(shopId);
    await webContents.executeJavaScript(`window.__proofSocket.send(${JSON.stringify(JSON.stringify(command))})`, true);
    await waitFor(`frame result for ${shopId}`, () => observer.results.length > before);
    return observer.results[observer.results.length - 1];
  }

  async function emitBinary(shopId) {
    const observer = observers.get(shopId);
    const before = observer.results.length;
    const command = { kind: "proof-command", binary: true };
    const webContents = service.webContentsFor(shopId);
    await webContents.executeJavaScript(`window.__proofSocket.send(${JSON.stringify(JSON.stringify(command))})`, true);
    await waitFor(`binary result for ${shopId}`, () => observer.results.length > before);
    return observer.results[observer.results.length - 1];
  }

  function cleanup() {
    ipcMain.removeListener("pdd-page-event", pageEventListener);
    for (const observer of observers.values()) observer.detach();
    service.disposeAll();
    if (!hiddenWindow.isDestroyed()) hiddenWindow.destroy();
  }

  return { service, observers, collectorState, counters, activate, startSocket, emit, emitBinary, cleanup, hiddenWindow };
}

function assertResolution(actual, expectedValue, label) {
  assert.equal(actual?.status, "RESOLVED", `${label} must be RESOLVED`);
  assert.deepEqual(actual.value, expectedValue, `${label} value`);
}
function assertUnknown(actual, label) { assert.equal(actual?.status, "UNKNOWN", `${label} must be UNKNOWN`); }
function identitySummary(envelope) {
  return {
    platform: envelope.identityLock.platform,
    runtimeShop: envelope.identityLock.runtimeShop,
    merchantId: envelope.identityLock.merchantId,
    storeId: envelope.identityLock.storeId,
    platformAccountId: envelope.identityLock.platformAccountId,
    platformCustomerId: envelope.identityLock.platformCustomerId,
    internalConversationId: envelope.identityLock.internalConversationId,
    localMessageId: envelope.identityLock.triggerMessage.localMessageId,
    platformMessageIdentity: envelope.identityLock.triggerMessage.platformMessageIdentity,
    runtimeEvidence: envelope.identityLock.runtimeEvidence,
    sourceContent: envelope.sourceContent,
    sourceOccurredAt: envelope.sourceOccurredAt,
  };
}

function assertMapped(record) { assert.equal(record?.result?.status, "MAPPED", `expected MAPPED, got ${record?.result?.status ?? record?.status}`); return record.result.envelope; }

async function main() {
  await app.whenReady();
  const { server, port } = await startWebSocketServer();
  const h = createHarness(port);
  let result = "PARTIAL";
  let finalError = null;
  try {
    await step("A0", "same PddPlatformService activates two real WebContents sessions", async () => {
      await h.activate("shop-a");
      await h.activate("shop-b");
      assert.equal(h.observers.size, 2);
      assert.notEqual(h.service.webContentsFor("shop-a"), h.service.webContentsFor("shop-b"));
      return { shops: ["shop-a", "shop-b"], observerCount: h.observers.size };
    });
    const observerA = h.observers.get("shop-a");
    const observerB = h.observers.get("shop-b");
    await step("A1", "actual loopback connections bind at connection creation", async () => {
      await h.startSocket("shop-a");
      await h.startSocket("shop-b");
      assert.equal(observerA.bindings.size, 1);
      assert.equal(observerB.bindings.size, 1);
      return { a: [...observerA.bindings.keys()], b: [...observerB.bindings.keys()] };
    });
    const legacyBefore = h.counters.legacyBridgeCalls;
    const payloadA = { content: "  alpha\n" + "x".repeat(4105), from: { role: "user", uid: "6318084722818" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "opaque-message" };
    const payloadB = { content: "  beta\n" + "y".repeat(4105), from: { role: "user", uid: "6318084722818" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "opaque-message" };
    await step("A2", "A/B canonical identity and exact content assertions", async () => {
      const resultA = await h.emit("shop-a", payloadA, "2026-09-18T00:00:00Z");
      const resultB = await h.emit("shop-b", payloadB, "2026-09-18T00:00:01Z");
      const envelopeA = assertMapped(resultA);
      const envelopeB = assertMapped(resultB);
      assert.equal(envelopeA.identityLock.platform, "pdd");
      assertResolution(envelopeA.identityLock.runtimeShop, { value: "shop-a" }, "A runtimeShop");
      assertResolution(envelopeA.identityLock.merchantId, "merchant-shop-a", "A merchantId");
      assertResolution(envelopeA.identityLock.storeId, "store-shop-a", "A storeId");
      assertResolution(envelopeA.identityLock.platformAccountId, "account-shop-a", "A platformAccountId");
      assertResolution(envelopeA.identityLock.platformCustomerId, { value: "6318084722818" }, "A platformCustomerId");
      assertResolution(envelopeA.identityLock.internalConversationId, "conversation-shop-a", "A internalConversationId");
      assertResolution(envelopeA.identityLock.triggerMessage.localMessageId, "local-shop-a", "A localMessageId");
      assert.deepEqual(envelopeA.identityLock.triggerMessage.platformMessageIdentity, { provenance: "AUTHORITATIVE_PLATFORM_ID", value: "opaque-message" });
      assert.equal(envelopeA.sourceContent.text, payloadA.content);
      assert.equal(envelopeA.sourceOccurredAt, "2026-09-18T00:00:00Z");
      assert.equal(envelopeA.identityLock.runtimeEvidence?.selectedCustomerObservation?.status, "SELECTED");
      assert.equal(envelopeA.identityLock.runtimeEvidence?.selectedCustomerObservation?.platformCustomerId?.value, "999999");
      assertResolution(envelopeB.identityLock.runtimeShop, { value: "shop-b" }, "B runtimeShop");
      assertResolution(envelopeB.identityLock.merchantId, "merchant-shop-b", "B merchantId");
      assertResolution(envelopeB.identityLock.storeId, "store-shop-b", "B storeId");
      assertResolution(envelopeB.identityLock.platformAccountId, "account-shop-b", "B platformAccountId");
      assertResolution(envelopeB.identityLock.platformCustomerId, { value: "6318084722818" }, "B platformCustomerId");
      assertResolution(envelopeB.identityLock.internalConversationId, "conversation-shop-b", "B internalConversationId");
      assertResolution(envelopeB.identityLock.triggerMessage.localMessageId, "local-shop-b", "B localMessageId");
      assert.deepEqual(envelopeB.identityLock.triggerMessage.platformMessageIdentity, { provenance: "AUTHORITATIVE_PLATFORM_ID", value: "opaque-message" });
      assert.equal(envelopeB.sourceContent.text, payloadB.content);
      assert.equal(envelopeB.sourceOccurredAt, "2026-09-18T00:00:01Z");
      return { collectorCount: h.collectorState.envelopes.length, a: identitySummary(envelopeA), b: identitySummary(envelopeB) };
    });
    await step("A3", "invalid/cross-scope association is rejected without collector growth", async () => {
      const before = h.collectorState.envelopes.length;
      const record = await h.emit("shop-b", { content: "CROSS_SCOPE_ASSOCIATION", from: { role: "user", uid: "6318084722818" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "cross-message" });
      assert.equal(record.result?.status, "REJECTED");
      assert.equal(record.result?.reason, "ASSOCIATION_SCOPE_MISMATCH");
      assert.equal(h.collectorState.envelopes.length, before);
      return { reason: record.result.reason, before, after: h.collectorState.envelopes.length };
    });
    await step("A3b", "owner-runtime-shop association mismatch is rejected without collector growth", async () => {
      const before = h.collectorState.envelopes.length;
      const record = await h.emit("shop-b", { content: "CROSS_OWNER_ASSOCIATION", from: { role: "user", uid: "6318084722818" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "cross-owner-message" });
      assert.equal(record.result?.status, "REJECTED");
      assert.equal(record.result?.reason, "ASSOCIATION_RUNTIME_SHOP_MISMATCH");
      assert.equal(h.collectorState.envelopes.length, before);
      return { reason: record.result.reason, before, after: h.collectorState.envelopes.length };
    });
    await step("A4", "missing identity remains explicit UNKNOWN", async () => {
      const result = await h.emit("shop-a", { content: "unknown", from: { role: "user" }, to: { role: "mall_cs" } });
      const envelope = assertMapped(result);
      assertUnknown(envelope.identityLock.platformCustomerId, "missing customerUid");
      assert.deepEqual(envelope.identityLock.triggerMessage.platformMessageIdentity, { provenance: "UNKNOWN" });
      assertUnknown(envelope.identityLock.internalConversationId, "missing association conversation");
      assertUnknown(envelope.identityLock.triggerMessage.localMessageId, "missing association localMessage");
      return { diagnostics: result.result.diagnostics };
    });
    await step("A5", "invalid identity is rejected and content/source-time boundaries hold", async () => {
      const before = h.collectorState.envelopes.length;
      const invalid = await h.emit("shop-a", { content: "invalid", from: { role: "user", uid: "not-numeric" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "invalid-message" });
      assert.equal(invalid.result?.status, "REJECTED");
      assert.equal(invalid.result?.reason, "customer_uid_invalid");
      assert.equal(h.collectorState.envelopes.length, before);
      const missingTime = await h.emit("shop-a", payloadA);
      const missingEnvelope = assertMapped(missingTime);
      assert.equal(missingEnvelope.sourceOccurredAt, null);
      assert.ok(missingTime.result.diagnostics.includes("SOURCE_TIME_MISSING"));
      const invalidTime = await h.emit("shop-a", payloadA, "2026-02-30T12:00:00Z");
      const invalidEnvelope = assertMapped(invalidTime);
      assert.equal(invalidEnvelope.sourceOccurredAt, null);
      assert.ok(invalidTime.result.diagnostics.includes("SOURCE_TIME_INVALID"));
      const binaryRequestId = [...observerA.bindings.keys()][0];
      const binary = observerA.replayFrame({ requestId: binaryRequestId, response: { opcode: 2, mask: false, payloadData: "AA==" } });
      assert.equal(binary.status, "REJECTED");
      assert.equal(binary.reason, "UNSUPPORTED_NON_TEXT_FRAME");
      return { invalid: invalid.result.reason, missingTime: missingEnvelope.sourceOccurredAt, invalidTime: invalidEnvelope.sourceOccurredAt, binary: binary.reason };
    });
    assert.equal(h.counters.legacyBridgeCalls, legacyBefore, "normal paths must not reach legacy bridge");

    await step("A6", "reload invalidates old connection and old connection-created events", async () => {
      const oldFrameIndex = observerA.capturedFrames.length - 1;
      const oldBinding = [...observerA.bindings.values()][0];
      const oldLifecycle = observerA.lifecycle;
      assert.ok(oldBinding);
      const before = h.collectorState.envelopes.length;
      await h.service.reload("shop-a");
      await waitFor("A reload lifecycle", () => observerA.lifecycle > oldLifecycle);
      await waitFor("A READY after reload", () => h.service.status("shop-a")?.session_status === "READY");
      const staleFrame = observerA.replayCapturedFrame(oldFrameIndex);
      assert.equal(staleFrame.status, "REJECTED");
      const staleConnection = observerA.replayConnectionCreated(oldBinding, oldLifecycle);
      assert.equal(staleConnection.status, "REJECTED");
      await h.startSocket("shop-a");
      const fresh = await h.emit("shop-a", payloadA, "2026-09-18T00:00:02Z");
      assertMapped(fresh);
      assert.equal(h.collectorState.envelopes.length, before + 1);
      return { oldLifecycle, newLifecycle: observerA.lifecycle, staleFrame: staleFrame.reason, staleConnection: staleConnection.reason, collectorDelta: h.collectorState.envelopes.length - before };
    });

    await step("A7", "dispose/recreate/destroy/detach cannot revive old events", async () => {
      const oldObserver = observerA;
      const oldFrameIndex = oldObserver.capturedFrames.length - 1;
      const before = h.collectorState.envelopes.length;
      h.service.disposeAll();
      oldObserver.detach();
      const oldReplay = oldObserver.replayCapturedFrame(oldFrameIndex);
      assert.equal(oldReplay.status, "STOPPED");
      assert.equal(h.collectorState.envelopes.length, before);
      await h.activate("shop-a");
      const freshObserver = h.observers.get("shop-a");
      await h.startSocket("shop-a");
      const fresh = await h.emit("shop-a", payloadA, "2026-09-18T00:00:03Z");
      assertMapped(fresh);
      const currentFrameIndex = freshObserver.capturedFrames.length - 1;
      freshObserver.detach();
      const detachedReplay = freshObserver.replayCapturedFrame(currentFrameIndex);
      assert.equal(detachedReplay.status, "STOPPED");
      await freshObserver.reattach();
      await freshObserver.ready;
      await h.startSocket("shop-a");
      const reattached = await h.emit("shop-a", payloadA, "2026-09-18T00:00:04Z");
      assertMapped(reattached);
      return { oldReplay: oldReplay.reason, detachedReplay: detachedReplay.reason, observerLifecycle: freshObserver.lifecycle, collectorDelta: h.collectorState.envelopes.length - before };
    });

    const failureShop = "shop-a";
    const originalValidator = h.service.options.canonicalEnvelopeValidator;
    const originalIdentityResolver = h.service.options.resolveInboundIdentity;
    const originalCollector = h.service.options.onCanonicalInbound;
    const failurePayload = { content: "T07A-identity", from: { role: "user", uid: "7001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "t07a-message" };
    async function runPreCollectorFailure(label, mutate, expectedReason) {
      mutate();
      const beforeCalls = h.collectorState.calls;
      const beforeEnvelopes = h.collectorState.envelopes.length;
      const record = await h.emit(failureShop, { ...failurePayload, content: label });
      assert.equal(record.result?.status, "FAILED", `${label} status`);
      assert.equal(record.result?.reason, expectedReason, `${label} reason`);
      assert.equal(h.collectorState.calls, beforeCalls, `${label} must not call collector`);
      assert.equal(h.collectorState.envelopes.length, beforeEnvelopes, `${label} must not append`);
      return { reason: record.result.reason, collectorCalls: h.collectorState.calls - beforeCalls };
    }
    await step("T07A1", "validator unavailable fails before collector", async () => {
      const evidence = await runPreCollectorFailure("validator-unavailable", () => { h.service.options.canonicalEnvelopeValidator = null; }, "CANONICAL_VALIDATOR_UNAVAILABLE");
      h.service.options.canonicalEnvelopeValidator = originalValidator;
      return evidence;
    });
    await step("T07A2", "validator false fails before collector", async () => {
      const evidence = await runPreCollectorFailure("validator-false", () => { h.service.options.canonicalEnvelopeValidator = () => false; }, "CANONICAL_VALIDATION_FAILED");
      h.service.options.canonicalEnvelopeValidator = originalValidator;
      return evidence;
    });
    await step("T07A3", "validator throw fails before collector", async () => {
      const evidence = await runPreCollectorFailure("validator-throw", () => { h.service.options.canonicalEnvelopeValidator = () => { throw new Error("fixture-validator-throw"); }; }, "CANONICAL_VALIDATOR_THREW");
      h.service.options.canonicalEnvelopeValidator = originalValidator;
      return evidence;
    });
    await step("T07A4", "identity resolver throw fails before collector", async () => {
      const evidence = await runPreCollectorFailure("identity-throw", () => { h.service.options.resolveInboundIdentity = () => { throw new Error("fixture-identity-throw"); }; }, "IDENTITY_BINDING_RESOLVER_THREW");
      h.service.options.resolveInboundIdentity = originalIdentityResolver;
      return evidence;
    });
    await step("T07A5", "missing collector returns STOPPED without a call", async () => {
      const beforeCalls = h.collectorState.calls;
      h.service.options.onCanonicalInbound = undefined;
      const record = await h.emit(failureShop, { ...failurePayload, content: "collector-missing" });
      assert.equal(record.result?.status, "STOPPED");
      assert.equal(record.result?.reason, "COLLECTOR_MISSING");
      assert.equal(h.collectorState.calls, beforeCalls);
      h.service.options.onCanonicalInbound = originalCollector;
      return { reason: record.result.reason, collectorCalls: h.collectorState.calls - beforeCalls };
    });

    await step("T07B1", "collector sync throw returns FAILED after one call", async () => {
      let calls = 0;
      h.service.options.onCanonicalInbound = () => { calls += 1; throw new Error("fixture-collector-sync-throw"); };
      const record = await h.emit(failureShop, { ...failurePayload, content: "collector-sync-throw" });
      assert.equal(record.result?.status, "FAILED");
      assert.equal(record.result?.reason, "COLLECTOR_THREW");
      assert.equal(calls, 1);
      h.service.options.onCanonicalInbound = originalCollector;
      return { reason: record.result.reason, calls };
    });
    await step("T07B2", "collector rejected Promise returns FAILED, observes rejection, no retry", async () => {
      let calls = 0;
      h.service.options.onCanonicalInbound = () => { calls += 1; return Promise.reject(new Error("fixture-collector-async-reject")); };
      const record = await h.emit(failureShop, { ...failurePayload, content: "collector-async-reject" });
      assert.equal(record.result?.status, "FAILED");
      assert.equal(record.result?.reason, "ASYNC_COLLECTOR_UNSUPPORTED");
      assert.equal(calls, 1);
      await delay(50);
      assert.equal(unhandledRejections.length, 0, "collector rejection must be observed");
      h.service.options.onCanonicalInbound = originalCollector;
      return { reason: record.result.reason, calls, unhandledRejections: unhandledRejections.length };
    });
    assert.equal(h.counters.legacyBridgeCalls, legacyBefore, "failure paths must not reach legacy bridge");
    result = failures.length === 0 ? "COMPLETE" : "PARTIAL";
  } catch (error) {
    finalError = String(error?.stack ?? error);
    result = "PARTIAL";
  } finally {
    try { h.cleanup(); } catch (error) { checks.push({ id: "CLEANUP", name: "cleanup", status: "FAIL", error: String(error?.stack ?? error) }); result = "PARTIAL"; }
    try { server.close(); } catch {}
    const report = {
      task: "SHEEP-301",
      acceptance_unit: "LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF",
      baseline_commit: BASELINE,
      result,
      diagnostic_proof_implementation_performed: true,
      offline_boundary_proof_performed: result === "COMPLETE",
      production_implementation_performed: false,
      production_pdd_ingress_readiness: "BLOCKED",
      live_validation_authorization: "NOT_AUTHORIZED",
      live_validation_performed: false,
      full_sheep_301_closed: false,
      next_stage_not_executed: true,
      controller_review_status: "AWAITING_CONTROLLER_REVIEW",
      command: "electron --no-sandbox --disable-gpu scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs",
      versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
      source_version: { repository_head: BASELINE, proof_runner: "scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs", fixture: "scripts/fixtures/sheep-301-local-electron-websocket-boundary/fixture.html", observer: "scripts/fixtures/sheep-301-local-electron-websocket-boundary/observer.mjs", proof_sources_committed_at_run: false, source_state_note: "Repository HEAD was the baseline; new proof scripts/report were uncommitted at runtime. Product modules were freshly built from the current source worktree before this proof." },
      build_commands: ["pnpm --filter @fastwork/domain build", "pnpm --filter @fastwork/platform-pdd build", "pnpm --filter @fastwork/desktop build"],
      exact_command: ".\\node_modules\\.pnpm\\electron@43.6.0\\node_modules\\electron\\dist\\electron.exe --no-sandbox --disable-gpu .\\scripts\\run-sheep-301-local-electron-websocket-boundary-proof.mjs",
      acceptance_matrix: {
        A_real_local_transport: "A0-A2 and A5",
        B_same_service_two_shop_isolation: "A0-A3",
        C_lifecycle: "A6-A7",
        D_field_semantics: "A2-A5",
        E_t07a_pre_collector: "T07A1-T07A5",
        F_t07b_post_collector: "T07B1-T07B2",
        G_downstream_isolation: "counters and legacy bridge checks",
      },
      lifecycle_timeline: {
        connection_created: "observer binds WebContents/session/document context before any frame is accepted",
        frame_delivery: "frame lookup uses the pre-existing requestId binding",
        reload: "Main navigation invalidates bindings; old frame and old connection-created replays are rejected",
        dispose_recreate: "old observer terminal; new WebContents/session/observer lifecycle required",
        detach_reattach: "old events remain terminal; reattach starts a new lifecycle and new connection binding",
        unknown_or_unbound: "dropped or rejected before canonical collector",
      },
      evidence_types: {
        actual_electron_cdp_events: ["A1-A7 real loopback WebSocket traffic through WebContents.debugger"],
        controlled_replay: ["A5 non-text opcode injection", "A6 old frame and old connection-created replay"],
        synthetic_failure_injection: ["T07A/T07B option mutation for validator/resolver/collector failures"],
        code_boundary: ["no AI/send/persistence dependency in selected path"],
      },
      historical_probe_path_verification: {
        classification: "ACTUAL_ROOT_OUTSIDE_WRITE",
        prior_script: "E:\\fast_sheep.tmp\\sheep-301-real-producer-audit\\probe-main.cjs",
        prior_result: "E:\\fast_sheep.tmp\\sheep-301-real-producer-audit\\probe-result.json",
        corrected_new_proof_root: "E:\\fast_sheep.tmp\\sheep-301-local-electron-websocket-boundary-proof",
        cleanup_authorized: false,
      },
      known_limitations: [
        "The payload is synthetic fixture data and does not prove actual Titan outer framing, compression, fragmentation, reconnect, or replay behavior.",
        "The fixture connects after document READY and does not prove early page connection behavior.",
        "The local loopback endpoint is not a real PDD/Titan endpoint.",
        "The sourceOccurredAt values are synthetic and do not establish real platform time semantics.",
        "The test uses test-owned resolver, collector, and option mutation; it does not prove production composition wiring.",
      ],
      proven: ["Electron/WebContents/Debugger/Network event boundary", "connection-time requestId binding", "same-service two-shop isolation", "reload/dispose/recreate/destroy/detach invalidation", "collector-before and collector-after failure semantics", "downstream counters at the selected boundary"],
      not_proven: ["real PDD/Titan URL and runtime compatibility", "actual Titan payload framing or compression", "real reconnect/replay semantics", "real business source time", "production implementation or authorization"],
      checks,
      failures,
      counters: h.counters,
      collector: { calls: h.collectorState.calls, envelopes: h.collectorState.envelopes.length },
      measurement_boundary: {
        legacy_bridge: "dynamic orchestrator stub counter",
        ai_send_persistence: "no AI, send, or persistence dependency is present in the selected test path; counters remain zero by code-boundary construction",
        synthetic_ws_traffic: "loopback-only test traffic, counted separately from business send",
        diagnostic_report_write: "one test report write, not business persistence"
      },
      unhandled_rejections: unhandledRejections,
      error: finalError,
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    app.exit(result === "COMPLETE" ? 0 : 1);
  }
}

main().catch((error) => {
  writeFileSync(REPORT_PATH, JSON.stringify({ result: "PARTIAL", error: String(error?.stack ?? error) }, null, 2) + "\n", "utf8");
  app.exit(1);
});
