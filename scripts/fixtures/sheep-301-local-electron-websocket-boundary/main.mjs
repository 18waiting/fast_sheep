import { app, BrowserWindow, ipcMain, WebContentsView } from "electron";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PddPlatformService } from "../../../apps/desktop/dist/main/platforms/pdd/pdd-platform-service.js";
import { PddViewHost } from "../../../apps/desktop/dist/main/platforms/pdd/pdd-view-host.js";
import { BoundaryObserver } from "./observer.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const FIXTURE_PATH = join(HERE, "fixture.html");
const PDD_PRELOAD = join(REPO_ROOT, "apps", "desktop", "dist", "platforms", "pdd", "preload.js");
const PROJECT_TEMP_PARENT = resolve(dirname(REPO_ROOT), `${basename(REPO_ROOT)}.tmp`);
const EXPECTED_TEMP_ROOT = resolve(PROJECT_TEMP_PARENT, "sheep-301-local-electron-websocket-boundary-proof");
const TEMP_ROOT = EXPECTED_TEMP_ROOT;
const RUN_ID = `run-${process.pid}-${Date.now()}`;
const REPORT_PATH = join(REPO_ROOT, "reports", "SHEEP-301-local-electron-websocket-boundary-proof-report.json");
const LAUNCHER_PATH = process.env.SHEEP301_PROOF_LAUNCHER ?? null;
const READINESS_BASELINE = "8fb05f70d264943447981d19aa71a1dd4618c2b5";
const REPAIR_BASELINE = "ab205372f858db736405ff2195bc9a307acae9a1";

function childPath(...parts) {
  const candidate = resolve(TEMP_ROOT, ...parts);
  const rel = relative(TEMP_ROOT, candidate);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return candidate;
  throw new Error("proof path escapes derived temp root: " + candidate);
}
if (resolve(TEMP_ROOT) !== EXPECTED_TEMP_ROOT) throw new Error("derived proof temp root mismatch");
const RUN_ROOT = childPath(RUN_ID);
const EXECUTION_PATHS = {
  repoRoot: REPO_ROOT,
  proofRoot: TEMP_ROOT,
  runRoot: RUN_ROOT,
  userData: childPath(RUN_ID, "user-data"),
  sessionData: childPath(RUN_ID, "session-data"),
  cache: childPath(RUN_ID, "cache"),
  temp: childPath(RUN_ID, "temp"),
  logs: childPath(RUN_ID, "logs"),
};
for (const path of Object.values(EXECUTION_PATHS)) mkdirSync(path, { recursive: true });
app.setPath("userData", EXECUTION_PATHS.userData);
app.setPath("sessionData", EXECUTION_PATHS.sessionData);
app.setPath("cache", EXECUTION_PATHS.cache);
app.setPath("temp", EXECUTION_PATHS.temp);
app.setAppLogsPath(EXECUTION_PATHS.logs);
app.commandLine.appendSwitch("disable-gpu");

const packageRequire = createRequire(join(REPO_ROOT, "packages", "platform-pdd", "package.json"));
let WebSocketServer;
let jsdomEntry;
let wsEntry;
try {
  jsdomEntry = packageRequire.resolve("jsdom");
  const jsdomRequire = createRequire(jsdomEntry);
  wsEntry = jsdomRequire.resolve("ws");
  ({ WebSocketServer } = jsdomRequire("ws"));
  if (typeof WebSocketServer !== "function") throw new Error("WebSocketServer export missing");
} catch (error) {
  throw new Error("Unable to resolve ws through the repository's declared jsdom dependency: " + error.message);
}
const dependencyResolution = { electronExecutable: process.execPath, wsEntry, wsResolver: jsdomEntry };

function runGit(args) {
  try { return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; }
}
function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
const runtimeRepositoryHead = runGit(["rev-parse", "HEAD"]);
const runtimeWorktreeStatus = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
const scriptDigests = {
  runner: sha256File(fileURLToPath(import.meta.url)),
  launcher: LAUNCHER_PATH ? sha256File(LAUNCHER_PATH) : null,
  observer: sha256File(join(HERE, "observer.mjs")),
  fixture: sha256File(FIXTURE_PATH),
};

const checks = [];
const failures = [];
let proofExecuted = false;
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
const associationRecords = new Map();
function associationRecordKey(shopId, scope, customerUid, platformMessageId) {
  const scopeKey = [scope.merchantId, scope.storeId, scope.platformAccountId]
    .map((entry) => entry.status === "RESOLVED" ? entry.value : entry.status).join("|");
  return [shopId, scopeKey, customerUid, platformMessageId].join("|");
}
function createAssociationRecords() {
  for (const shopId of ["shop-a", "shop-b"]) {
    const scope = scopeFor(shopId);
    for (const key of [
      { customerUid: "6318084722818", platformMessageId: "opaque-message", conversation: `conversation-${shopId}`, local: `local-${shopId}` },
      { customerUid: "1001", platformMessageId: "same-id", conversation: `same-conversation-${shopId}`, local: `same-local-${shopId}` },
      { customerUid: "7001", platformMessageId: "t07a-message", conversation: `t07a-conversation-${shopId}`, local: `t07a-local-${shopId}` },
      { customerUid: "7001", platformMessageId: "cross-message", conversation: `cross-conversation-${shopId}`, local: `cross-local-${shopId}` },
      { customerUid: "7001", platformMessageId: "cross-owner-message", conversation: `cross-owner-conversation-${shopId}`, local: `cross-owner-local-${shopId}` },
    ]) {
      const record = {
        ownerRuntimeShopId: shopId,
        ownerScope: scope,
        platformCustomerId: key.customerUid,
        platformMessageId: key.platformMessageId,
        internalConversationId: resolution(key.conversation),
        localMessageId: resolution(key.local),
      };
      associationRecords.set(associationRecordKey(shopId, scope, key.customerUid, key.platformMessageId), record);
    }
  }
}
createAssociationRecords();
const identityControl = { mode: "normal", targetShopId: null };
function associationFor(shopId, message) {
  if (message.customerUid === undefined || message.platformMessageId === undefined) return undefined;
  if (identityControl.mode === "cross-owner" && (!identityControl.targetShopId || identityControl.targetShopId === shopId)) {
    return {
      ownerRuntimeShopId: shopId === "shop-a" ? "shop-b" : "shop-a",
      ownerScope: scopeFor(shopId),
      platformCustomerId: message.customerUid,
      platformMessageId: message.platformMessageId,
      internalConversationId: resolution(`owner-mismatch-conversation-${shopId}`),
      localMessageId: resolution(`owner-mismatch-local-${shopId}`),
    };
  }
  if (identityControl.mode === "cross-scope" && (!identityControl.targetShopId || identityControl.targetShopId === shopId)) {
    return {
      ownerRuntimeShopId: shopId,
      ownerScope: scopeFor(shopId === "shop-a" ? "shop-b" : "shop-a"),
      platformCustomerId: message.customerUid,
      platformMessageId: message.platformMessageId,
      internalConversationId: resolution(`foreign-conversation-${shopId}`),
      localMessageId: resolution(`foreign-local-${shopId}`),
    };
  }
  const scope = scopeFor(shopId);
  return associationRecords.get(associationRecordKey(shopId, scope, message.customerUid, message.platformMessageId));
}
function createStubOrchestrator(counters) {
  return {
    onBuyerMessage: async () => { counters.legacyBridgeCalls += 1; },
    onHumanTakeover: async () => { counters.legacyBridgeCalls += 1; },
    onFocusShop: () => { counters.legacyBridgeCalls += 1; },
  };
}

async function startWebSocketServer() {
  const traffic = { connections: 0, commandsReceived: 0, framesSent: 0 };
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  server.on("connection", (socket) => {
    traffic.connections += 1;
    socket.on("message", (data, isBinary) => {
      traffic.commandsReceived += 1;
      if (isBinary) { traffic.framesSent += 1; socket.send(Buffer.from("binary-fixture")); return; }
      let command;
      try { command = JSON.parse(data.toString()); } catch { return; }
      if (command?.kind !== "proof-command") return;
      if (command.binary) { traffic.framesSent += 1; socket.send(Buffer.from("binary-fixture")); return; }
      traffic.framesSent += 1;
      socket.send(JSON.stringify({ kind: "proof-frame", payload: command.payload, sourceOccurredAt: command.sourceOccurredAt }));
    });
  });
  return { server, port: server.address().port, traffic };
}

function createHarness(port, wsTraffic) {
  const hiddenWindow = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  const observers = new Map();
  const sessionInfo = new Map();
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
    const partition = `memory:sheep301-proof-${RUN_ID}-${shopId}`;
    const view = new PddViewHost({
      shopId,
      navigationMode: "FIXTURE",
      createView: () => new WebContentsView({
        webPreferences: {
          partition,
          preload: PDD_PRELOAD,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      }),
    });
    const session = view.webContents.session;
    sessionInfo.set(shopId, { partition, isPersistent: session.isPersistent(), storagePath: session.getStoragePath(), webContentsId: view.webContents.id });
    const observer = new BoundaryObserver({
      webContents: view.webContents,
      shopId,
      allowedUrl: (url) => String(url).startsWith(`ws://127.0.0.1:${port}/`),
      getService: () => service,
      allowedCdpSessionIds: [""],
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
    resolveInboundIdentity: (message, document) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: scopeFor(document.shopId),
      runtimeConversationReference: resolution({ value: `runtime-${document.shopId}` }),
      association: associationFor(document.shopId, message),
      selectedCustomerObservation: { status: "SELECTED", platformCustomerId: { value: "999999" } },
    }),
    onCanonicalInbound: collector,
  });
  const pageEventListener = (event, payload) => {
    if (service.isTrustedPddWebContents(event.sender)) service.handlePageEvent(payload);
  };
  ipcMain.on("pdd-page-event", pageEventListener);

  function instrumentSendBoundary() {
    for (const adapter of service.adapters.values()) {
      adapter.sendText = async () => { counters.transportSendCalls += 1; throw new Error("transport-send-forbidden-in-proof"); };
      adapter.onTransfer = () => { counters.transportSendCalls += 1; throw new Error("transfer-forbidden-in-proof"); };
    }
  }

  async function activate(shopId) {
    await service.activate(shopId);
    instrumentSendBoundary();
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
      try { window.__proofSocket?.close(); } catch {}
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

  function cleanup() {
    ipcMain.removeListener("pdd-page-event", pageEventListener);
    for (const observer of observers.values()) observer.detach();
    service.disposeAll();
    if (!hiddenWindow.isDestroyed()) hiddenWindow.destroy();
  }

  return { service, observers, sessionInfo, collectorState, counters, wsTraffic, activate, startSocket, emit, cleanup, hiddenWindow };
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
  const { server, port, traffic } = await startWebSocketServer();
  const h = createHarness(port, traffic);
  let result = "PARTIAL";
  let finalError = null;
  try {
    await step("A0", "same PddPlatformService activates two real isolated WebContents sessions", async () => {
      await h.activate("shop-a");
      await h.activate("shop-b");
      assert.equal(h.observers.size, 2);
      assert.notEqual(h.service.webContentsFor("shop-a"), h.service.webContentsFor("shop-b"));
      const a = h.sessionInfo.get("shop-a");
      const b = h.sessionInfo.get("shop-b");
      assert.ok(a && b);
      assert.notEqual(a.partition, b.partition);
      assert.equal(a.isPersistent, false);
      assert.equal(b.isPersistent, false);
      assert.equal(a.storagePath, null);
      assert.equal(b.storagePath, null);
      proofExecuted = true;
      return { shops: ["shop-a", "shop-b"], observerCount: h.observers.size, sessions: { a, b } };
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
    let legalA = null;
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
      legalA = { frameIndex: observerA.capturedFrames.length - 1, binding: [...observerA.bindings.values()][0] };
      assert.ok(legalA.binding, "legal A connection binding missing");
      return { collectorCount: h.collectorState.envelopes.length, a: identitySummary(envelopeA), b: identitySummary(envelopeB) };
    });
    await step("A3", "invalid/cross-scope association is rejected without collector growth", async () => {
      const before = h.collectorState.envelopes.length;
      identityControl.mode = "cross-scope";
      identityControl.targetShopId = "shop-b";
      let record;
      try { record = await h.emit("shop-b", { content: "cross-scope", from: { role: "user", uid: "7001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "cross-message" }); } finally { identityControl.mode = "normal"; identityControl.targetShopId = null; }
      assert.equal(record.result?.status, "REJECTED");
      assert.equal(record.result?.reason, "ASSOCIATION_SCOPE_MISMATCH");
      assert.equal(h.collectorState.envelopes.length, before);
      return { reason: record.result.reason, before, after: h.collectorState.envelopes.length };
    });
    await step("A3b", "owner-runtime-shop association mismatch is rejected without collector growth", async () => {
      const before = h.collectorState.envelopes.length;
      identityControl.mode = "cross-owner";
      identityControl.targetShopId = "shop-b";
      let record;
      try { record = await h.emit("shop-b", { content: "cross-owner", from: { role: "user", uid: "7001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "cross-owner-message" }); } finally { identityControl.mode = "normal"; identityControl.targetShopId = null; }
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
      const binding = legalA?.binding;
      assert.ok(binding, "legal A binding required for non-text injection");
      const binary = observerA.injectFrameWithSession({ requestId: binding.requestId, response: { opcode: 2, mask: false, payloadData: "AA==" } }, binding.cdpSessionId, binding.callbackToken);
      assert.equal(binary.status, "REJECTED");
      assert.equal(binary.reason, "UNSUPPORTED_NON_TEXT_FRAME");
      return { invalid: invalid.result.reason, missingTime: missingEnvelope.sourceOccurredAt, invalidTime: invalidEnvelope.sourceOccurredAt, binary: binary.reason };
    });
    assert.equal(h.counters.legacyBridgeCalls, legacyBefore, "normal paths must not reach legacy bridge");

    await step("A6", "reload rejects the original callback and both old event classes", async () => {
      assert.ok(legalA?.binding, "legal A binding missing before lifecycle test");
      const oldFrameIndex = legalA.frameIndex;
      const oldBinding = legalA.binding;
      const oldLifecycle = observerA.lifecycle;
      const before = h.collectorState.envelopes.length;
      await h.service.reload("shop-a");
      await waitFor("A reload lifecycle", () => observerA.lifecycle > oldLifecycle);
      await waitFor("A READY after reload", () => h.service.status("shop-a")?.session_status === "READY");
      const staleFrame = observerA.replayCapturedFrame(oldFrameIndex);
      assert.equal(staleFrame.status, "REJECTED");
      assert.equal(staleFrame.reason, "STALE_CALLBACK_GENERATION");
      const staleConnection = observerA.replayCapturedConnectionCreated(oldBinding);
      assert.equal(staleConnection.status, "REJECTED");
      assert.equal(staleConnection.reason, "STALE_CALLBACK_GENERATION");
      assert.equal(h.collectorState.envelopes.length, before, "old events must not reach collector");
      await h.startSocket("shop-a");
      const fresh = await h.emit("shop-a", payloadA, "2026-09-18T00:00:02Z");
      assertMapped(fresh);
      assert.equal(h.collectorState.envelopes.length, before + 1);
      return { oldLifecycle, newLifecycle: observerA.lifecycle, staleFrame: staleFrame.reason, staleConnection: staleConnection.reason, collectorDelta: h.collectorState.envelopes.length - before };
    });

    await step("A7", "dispose, destroy, external detach, and reattach cannot revive old events", async () => {
      const oldObserver = observerA;
      const oldFrameIndex = oldObserver.capturedFrames.length - 1;
      const before = h.collectorState.envelopes.length;
      h.service.disposeAll();
      await oldObserver.requestExternalDetach();
      const oldReplay = oldObserver.replayCapturedFrame(oldFrameIndex);
      assert.equal(oldReplay.status, "STOPPED");
      assert.equal(h.collectorState.envelopes.length, before);
      const oldSnapshot = oldObserver.snapshot();
      assert.equal(oldSnapshot.messageListenerCount, 0);
      assert.equal(oldSnapshot.navigationListenerRegistered, false);
      await h.activate("shop-a");
      const freshObserver = h.observers.get("shop-a");
      await h.startSocket("shop-a");
      const fresh = await h.emit("shop-a", payloadA, "2026-09-18T00:00:03Z");
      assertMapped(fresh);
      const currentFrameIndex = freshObserver.capturedFrames.length - 1;
      await freshObserver.requestExternalDetach();
      assert.equal(freshObserver.snapshot().messageListenerCount, 0);
      assert.equal(freshObserver.snapshot().navigationListenerRegistered, false);
      const detachedReplay = freshObserver.replayCapturedFrame(currentFrameIndex);
      assert.equal(detachedReplay.status, "STOPPED");
      await freshObserver.reattach();
      await freshObserver.ready;
      await h.startSocket("shop-a");
      const reattached = await h.emit("shop-a", payloadA, "2026-09-18T00:00:04Z");
      assertMapped(reattached);
      return { oldReplay: oldReplay.reason, oldListenerCounts: { message: oldSnapshot.messageListenerCount, navigation: oldSnapshot.navigationListenerCount }, detachedReplay: detachedReplay.reason, observerLifecycle: freshObserver.lifecycle, collectorDelta: h.collectorState.envelopes.length - before };
    });

    await step("A8", "CDP session collision, unknown request, and wrong sender/context fail before collector", async () => {
      const observer = h.observers.get("shop-a");
      const preceding = h.collectorState.envelopes.length;
      const binding = [...observer.bindings.values()].find((candidate) => candidate.callbackToken === observer.activeToken);
      assert.ok(binding, "active legal binding required for source-scope checks");
      const legalFrame = observer.capturedFrames[observer.capturedFrames.length - 1];
      assert.ok(legalFrame, "captured legal frame required for source-scope checks");
      const unauthorizedSession = observer.injectFrameWithSession({ requestId: binding.requestId, response: legalFrame.response }, "forbidden-cdp-session", observer.activeToken);
      assert.equal(unauthorizedSession.status, "REJECTED");
      assert.equal(unauthorizedSession.reason, "UNAUTHORIZED_CDP_SESSION");
      const beforeBindings = observer.bindings.size;
      const unauthorizedConnection = observer.handleDebuggerMessage("Network.webSocketCreated", { requestId: "forbidden-request", url: `ws://127.0.0.1:${port}/?shop=shop-a` }, "forbidden-cdp-session", observer.activeToken);
      assert.equal(observer.bindings.size, beforeBindings, "unauthorized connection must not create a binding");
      const unknownRequest = observer.injectFrameWithSession({ requestId: "unknown-request", response: legalFrame.response }, "", observer.activeToken);
      assert.equal(unknownRequest.status, "REJECTED");
      assert.equal(unknownRequest.reason, "UNBOUND_OR_STALE_SOURCE");
      const wrongSender = h.service.handleTrustedInboundIngress({}, {}, { payload: payloadA });
      assert.equal(wrongSender.status, "REJECTED");
      const wrongContext = h.service.handleTrustedInboundIngress(observer.webContents, {}, { payload: payloadA });
      assert.equal(wrongContext.status, "REJECTED");
      assert.equal(h.collectorState.envelopes.length, preceding);
      return { unauthorizedFrame: unauthorizedSession.reason, unauthorizedConnection: unauthorizedConnection, unknownRequest: unknownRequest.reason, wrongSender: wrongSender.reason, wrongContext: wrongContext.reason, collectorDelta: h.collectorState.envelopes.length - preceding };
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
      readiness_baseline_commit: READINESS_BASELINE,
      repair_baseline_commit: REPAIR_BASELINE,
      result,
      diagnostic_proof_implementation_performed: true,
      offline_boundary_proof_performed: proofExecuted,
      production_implementation_performed: false,
      production_pdd_ingress_readiness: "BLOCKED",
      live_validation_authorization: "NOT_AUTHORIZED",
      live_validation_performed: false,
      full_sheep_301_closed: false,
      next_stage_not_executed: true,
      controller_review_status: "AWAITING_CONTROLLER_REVIEW",
      command: "node scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs",
      versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
      execution_paths: EXECUTION_PATHS,
      electron_executable: process.execPath,
      dependency_resolution: dependencyResolution,
      runtime_configuration: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, no_sandbox_switch_used: false, memory_partitions: Object.fromEntries(h.sessionInfo) },
      runtime_source: { repository_head: runtimeRepositoryHead, repair_baseline: REPAIR_BASELINE, worktree_status_porcelain: runtimeWorktreeStatus, script_digests: scriptDigests },
      build_commands: ["pnpm --filter @fastwork/domain build", "pnpm --filter @fastwork/platform-pdd build", "pnpm --filter @fastwork/desktop build"],
      exact_command: "node scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs",
      baseline_reproduction: {
        classification: "CONFIRMED_BY_BASELINE_SOURCE_AND_CONTROLLER_REPRO",
        R1: "Baseline runner used a literal sibling temp-root string, hardcoded ws installation path, sandbox-disabling switch, and default persistent partitions.",
        R2: "Baseline bindings were keyed by requestId only and ignored CDP sessionId.",
        R3: "Controller reproduced old webSocketCreated delivery reacquiring the current document context after navigation.",
        R4: "Baseline tests used content-marker association mutation, a non-text old frame, and no dynamic WebSocket traffic counters.",
      },
      r1_r4_repair_evidence: {
        R1: { before: "sibling temp-root string, hardcoded ws installation path, sandbox-disabling CLI switch, default persistent partitions", after: "REPO_ROOT-derived strict temp root, repository-resolved ws, sandboxed Electron, two distinct memory partitions" },
        R2: { before: "bindings keyed only by requestId; frame sessionId ignored", after: "WebContents id, observer lifecycle, CDP sessionId, callbackToken, and requestId form the source binding" },
        R3: { before: "old connection-created could call the live callback and obtain current document context", after: "callback generation is rolled on navigation/detach; captured old callback deliveries fail before context lookup" },
        R4: { before: "content-marker association mutation, non-text old-frame test, incomplete source counters", after: "creation-time association records with Main control injection, legal old text frame, dynamic WS and send-boundary counters" },
      },
      acceptance_matrix: {
        A_real_local_transport: "A0-A2 and A5",
        B_same_service_two_shop_isolation: "A0-A3b",
        C_lifecycle: "A6-A8",
        D_field_semantics: "A2-A5",
        E_t07a_pre_collector: "T07A1-T07A5",
        F_t07b_post_collector: "T07B1-T07B2",
        G_downstream_isolation: "counters, traffic counters, send spy, and legacy bridge checks",
      },
      lifecycle_timeline: {
        connection_created: "observer binds WebContents/session/document context before any frame is accepted",
        frame_delivery: "frame lookup uses the pre-existing requestId binding",
        reload: "Main navigation rolls the callback token and clears bindings; old callback deliveries are rejected before context lookup",
        dispose_recreate: "old observer terminal; new WebContents/session/observer lifecycle required",
        detach_reattach: "old events remain terminal; reattach starts a new lifecycle and new connection binding",
        unknown_or_unbound: "dropped or rejected before canonical collector",
      },
      evidence_types: {
        actual_electron_cdp_events: ["A1-A7 real loopback WebSocket traffic through WebContents.debugger"],
        captured_event_controlled_delivery: ["A6 legal text frame and connection-created captured event delivered after reload"],
        unit_level_event_injection: ["A5 non-text opcode injection", "A8 unauthorized CDP session and unknown requestId injection"],
        option_mutation: ["T07A/T07B validator, resolver, and collector option mutation"],
        static_code_boundary: ["AI and business persistence dependencies are absent from the selected path; send adapter methods are fail-fast spies"],
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
      counters: { ...h.counters, syntheticWebSocketTraffic: h.wsTraffic },
      collector: { calls: h.collectorState.calls, envelopes: h.collectorState.envelopes.length },
      measurement_boundary: {
        legacy_bridge: "dynamic orchestrator stub counter connected to the same boundary",
        transport_send: "fail-fast spy on created adapter sendText/onTransfer methods",
        ai_persistence: "static code boundary: no AiEngineClient or persistence repository is injected into the selected producer path",
        synthetic_ws_traffic: "dynamic loopback server counters for connections, commands, and frames sent",
        diagnostic_report_write: "one test report write, not business persistence"
      },
      unhandled_rejections: unhandledRejections,
      files_changed: [
        "project/PROJECT_STATE.json",
        "project/SHEEP_301_REAL_PRODUCER_READINESS_AUDIT.md",
        "reports/SHEEP-301-real-producer-readiness-audit.json",
        "reports/SHEEP-301-local-electron-websocket-boundary-proof-report.json",
        "scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs",
        "scripts/fixtures/sheep-301-local-electron-websocket-boundary/fixture.html",
        "scripts/fixtures/sheep-301-local-electron-websocket-boundary/main.mjs",
        "scripts/fixtures/sheep-301-local-electron-websocket-boundary/observer.mjs",
      ],
      controller_repair_record: {
        decision: "REPAIR",
        baseline_commit: REPAIR_BASELINE,
        repair_result: result,
        historical_relation: "Prior Codex COMPLETE was not Controller PASS; Controller REPAIR was applied and the repaired proof is reported separately.",
      },
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
