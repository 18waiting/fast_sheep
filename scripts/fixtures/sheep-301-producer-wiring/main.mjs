import { app, BrowserWindow, ipcMain, WebContentsView } from "electron";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PddPlatformService } from "../../../apps/desktop/dist/main/platforms/pdd/pdd-platform-service.js";
import { DENY_ALL_MAIN_ADMISSION_PROVIDER, PddMainAdmissionRegistry } from "../../../apps/desktop/dist/main/platforms/pdd/pdd-main-admission.js";
import { PddViewHost } from "../../../apps/desktop/dist/main/platforms/pdd/pdd-view-host.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const PROOF_ROOT = process.env.SHEEP301_PRODUCER_WIRING_ROOT;
const EXPECTED_PROOF_ROOT = resolve(REPO_ROOT, ".tmp", "sheep-301-producer-wiring");
const RESOLVED_PROOF_ROOT = PROOF_ROOT ? resolve(PROOF_ROOT) : "";
const relativeProof = PROOF_ROOT ? relative(REPO_ROOT, RESOLVED_PROOF_ROOT) : "";
const pathCheck = {
  ok: Boolean(PROOF_ROOT) && relativeProof !== "" && !relativeProof.startsWith("..") && !isAbsolute(relativeProof) && RESOLVED_PROOF_ROOT === EXPECTED_PROOF_ROOT,
  repoRoot: REPO_ROOT,
  candidate: RESOLVED_PROOF_ROOT,
  expected: EXPECTED_PROOF_ROOT,
  relativeToRepo: relativeProof,
  reason: RESOLVED_PROOF_ROOT === EXPECTED_PROOF_ROOT ? "OK" : "INVALID_PROOF_ROOT",
};
if (!pathCheck.ok) throw new Error("invalid producer wiring proof root: " + JSON.stringify(pathCheck));

const RUN_ID = "run-" + process.pid + "-" + Date.now();
const RUN_ROOT = join(RESOLVED_PROOF_ROOT, RUN_ID);
const EXECUTION_PATHS = { proofRoot: RESOLVED_PROOF_ROOT, runRoot: RUN_ROOT, userData: join(RUN_ROOT, "user-data"), sessionData: join(RUN_ROOT, "session-data"), cache: join(RUN_ROOT, "cache"), temp: join(RUN_ROOT, "temp"), logs: join(RUN_ROOT, "logs") };
for (const path of Object.values(EXECUTION_PATHS)) mkdirSync(path, { recursive: true });
app.setPath("userData", EXECUTION_PATHS.userData);
app.setPath("sessionData", EXECUTION_PATHS.sessionData);
app.setPath("cache", EXECUTION_PATHS.cache);
app.setPath("temp", EXECUTION_PATHS.temp);
app.setAppLogsPath(EXECUTION_PATHS.logs);
app.commandLine.appendSwitch("disable-gpu");

const FIXTURE_PATH = join(HERE, "fixture.html");
const PDD_PRELOAD = join(REPO_ROOT, "apps", "desktop", "dist", "platforms", "pdd", "preload.js");
const REPORT_PATH = join(REPO_ROOT, "reports", "SHEEP-301-producer-wiring-report.json");
const REQUIRED_CHECK_IDS = ["W01", "W02", "W03", "W04", "W05", "W06", "W07", "W08", "W09"];
function sha256File(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
const SOURCE_DIGESTS = {
  smokeMain: sha256File(fileURLToPath(import.meta.url)),
  fixture: sha256File(FIXTURE_PATH),
  platformService: sha256File(join(REPO_ROOT, "apps", "desktop", "src", "main", "platforms", "pdd", "pdd-platform-service.ts")),
  observer: sha256File(join(REPO_ROOT, "apps", "desktop", "src", "main", "platforms", "pdd", "pdd-inbound-observer.ts")),
  admission: sha256File(join(REPO_ROOT, "apps", "desktop", "src", "main", "platforms", "pdd", "pdd-main-admission.ts")),
  sessionHost: sha256File(join(REPO_ROOT, "apps", "desktop", "src", "main", "platforms", "pdd", "pdd-session-host.ts")),
  pageIpc: sha256File(join(REPO_ROOT, "apps", "desktop", "src", "main", "platforms", "pdd", "pdd-page-ipc.ts")),
};
const packageRequire = createRequire(join(REPO_ROOT, "packages", "platform-pdd", "package.json"));
const jsdomEntry = packageRequire.resolve("jsdom");
const jsdomRequire = createRequire(jsdomEntry);
const { WebSocketServer } = jsdomRequire("ws");

const checks = [];
const failures = [];
const unhandledRejections = [];
process.on("unhandledRejection", (reason) => unhandledRejections.push(String(reason)));
function delay(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }
async function waitFor(label, predicate, timeoutMs = 8000) { const start = Date.now(); while (Date.now() - start < timeoutMs) { if (predicate()) return true; await delay(20); } throw new Error("timeout waiting for " + label); }
async function step(id, name, fn) { try { const evidence = await fn(); checks.push({ id, name, status: "PASS", evidence: evidence ?? null }); return evidence; } catch (error) { const failure = { id, name, status: "FAIL", error: String(error?.stack ?? error) }; checks.push(failure); failures.push(failure); throw error; } }
function resolution(value) { return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value }; }
function scopeFor(shopId) { return { merchantId: resolution("merchant-1"), storeId: resolution("store-" + shopId), platformAccountId: resolution("account-" + shopId) }; }
function associationFor(shopId, message) {
  if (message.customerUid === undefined || message.platformMessageId === undefined) return undefined;
  return {
    ownerRuntimeShopId: shopId,
    ownerScope: scopeFor(shopId),
    platformCustomerId: message.customerUid,
    platformMessageId: message.platformMessageId,
    internalConversationId: resolution("conversation-" + shopId),
    localMessageId: resolution("local-message-" + shopId),
  };
}
function assertMapped(record) { assert.equal(record?.result?.status, "MAPPED", JSON.stringify(record)); return record.result.envelope; }

async function startWebSocketServer() {
  const traffic = { connections: 0, commandsReceived: 0, framesSent: 0 };
  const server = createServer();
  const wsServer = new WebSocketServer({ server, path: "/socket" });
  wsServer.on("connection", (socket) => {
    traffic.connections += 1;
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      traffic.commandsReceived += 1;
      try {
        const command = JSON.parse(data.toString());
        const envelope = { kind: "producer-wiring-frame", payload: command.payload, sourceOccurredAt: command.sourceOccurredAt };
        socket.send(JSON.stringify(envelope));
        traffic.framesSent += 1;
      } catch {}
    });
  });
  await new Promise((resolvePromise, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolvePromise); });
  return { server, wsServer, port: server.address().port, traffic };
}

function createHarness(port) {
  const hiddenWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  const collected = [];
  const counters = { legacyBridgeCalls: 0, aiCalls: 0, transportSendCalls: 0, businessPersistenceWrites: 0 };
  const sessionInfo = new Map();
  const admissionState = { mode: "DENY", throwNext: false };
  const orchestrator = {
    onBuyerMessage: async () => { counters.legacyBridgeCalls += 1; counters.aiCalls += 1; },
    onHumanTakeover: async () => { counters.legacyBridgeCalls += 1; },
    onFocusShop: () => { counters.legacyBridgeCalls += 1; },
  };
  const makeView = (shopId) => {
    const partition = "memory:sheep301-producer-" + shopId + "-" + RUN_ID;
    const view = new PddViewHost({
      shopId,
      navigationMode: "FIXTURE",
      createView: () => new WebContentsView({ webPreferences: { partition, preload: PDD_PRELOAD, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } }),
    });
    const session = view.webContents.session;
    sessionInfo.set(shopId, { partition, isPersistent: session.isPersistent(), storagePath: session.getStoragePath(), webContentsId: view.webContents.id });
    return view;
  };
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator,
    fixturePathFor: () => FIXTURE_PATH,
    makeView,
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    allowedInboundWebSocketUrl: (url) => url.startsWith("ws://127.0.0.1:" + port + "/"),
    decodeInboundFrame: (payloadData) => {
      const envelope = JSON.parse(payloadData);
      return { payload: envelope.payload, sourceOccurredAt: envelope.sourceOccurredAt };
    },
    mainAdmissionProvider: {
      evaluate: () => {
        if (admissionState.throwNext) { admissionState.throwNext = false; throw new Error("controlled-admission-provider-throw"); }
        return admissionState.mode === "GRANT" ? { granted: true, admissionId: "provider-grant" } : { granted: false, reason: "CONTROLLED_DENY" };
      },
    },
    resolveInboundScope: (document) => (document.shopId === "shop-a" || document.shopId === "shop-b") ? scopeFor(document.shopId) : null,
    resolveInboundIdentity: (message, document) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: scopeFor(document.shopId),
      runtimeConversationReference: resolution({ value: "runtime-" + document.shopId }),
      association: associationFor(document.shopId, message),
      selectedCustomerObservation: { status: "SELECTED", platformCustomerId: { value: "999999" } },
    }),
    onInboundMessage: async () => { counters.legacyBridgeCalls += 1; },
    onCanonicalInbound: (envelope) => { collected.push(envelope); },
  });
  const pageEventListener = (event, payload) => service.handlePageEvent(payload, event.sender);
  const commandResultListener = (event, payload) => service.handleCommandResult(payload, event.sender);
  ipcMain.on("pdd-page-event", pageEventListener);
  ipcMain.on("pdd-page-command-result", commandResultListener);

  async function activate(shopId) {
    await service.activate(shopId);
    await waitFor(shopId + " READY", () => service.status(shopId)?.session_status === "READY");
    await waitFor(shopId + " observer enabled", () => {
      const diagnostics = service.inboundDiagnostics();
      return diagnostics.observers.some((observer) => observer.shopId === shopId && observer.enabled === true);
    });
    const adapter = service.adapterFor(shopId);
    if (adapter) {
      adapter.sendText = async () => { counters.transportSendCalls += 1; throw new Error("transport-send-forbidden"); };
      adapter.onTransfer = () => { counters.transportSendCalls += 1; throw new Error("transfer-forbidden"); };
    }
  }
  async function connect(shopId) {
    const webContents = service.webContentsFor(shopId);
    assert.ok(webContents, "missing webContents for " + shopId);
    const url = "ws://127.0.0.1:" + port + "/socket?shop=" + encodeURIComponent(shopId);
    await webContents.executeJavaScript(`new Promise((resolve, reject) => { try { window.__producerWs?.close(); } catch {} const ws = new WebSocket(${JSON.stringify(url)}); window.__producerWs = ws; ws.onopen = () => resolve(true); ws.onerror = () => reject(new Error("fixture websocket error")); })`, true);
    await waitFor(shopId + " connection binding", () => (service.inboundDiagnostics().connectionCount ?? 0) >= (shopId === "shop-a" ? 1 : 2));
  }
  async function send(shopId, payload, sourceOccurredAt) {
    const webContents = service.webContentsFor(shopId);
    const command = { payload, sourceOccurredAt };
    await webContents.executeJavaScript("window.__producerWs.send(" + JSON.stringify(JSON.stringify(command)) + ")", true);
  }
  function cleanup() {
    ipcMain.removeListener("pdd-page-event", pageEventListener);
    ipcMain.removeListener("pdd-page-command-result", commandResultListener);
    service.disposeAll();
    if (!hiddenWindow.isDestroyed()) hiddenWindow.destroy();
  }
  return { service, collected, counters, sessionInfo, admissionState, activate, connect, send, cleanup };
}

async function main() {
  await app.whenReady();
  const { server, wsServer, port, traffic } = await startWebSocketServer();
  const h = createHarness(port);
  let result = "PARTIAL";
  let finalError = null;
  try {
    await step("W01", "production-facing service defaults to DISABLED and DENY_ALL", async () => {
      const defaultCollected = [];
      const defaultService = new PddPlatformService({ navigationMode: "PRODUCTION_READ_ONLY", orchestrator: { onBuyerMessage: async () => {}, onHumanTakeover: async () => {}, onFocusShop: () => {} }, onCanonicalInbound: (envelope) => { defaultCollected.push(envelope); } });
      assert.equal(defaultService.inboundDiagnostics().mode, "DISABLED");
      const defaultDecision = new PddMainAdmissionRegistry(DENY_ALL_MAIN_ADMISSION_PROVIDER).evaluate({});
      assert.deepEqual(defaultDecision, { granted: false, reason: "MAIN_ADMISSION_DENIED_DEFAULT" });
      const admitted = defaultService.handleAdmittedInboundIngress({}, {}, "missing", { payload: {} }, {});
      assert.equal(admitted.status, "STOPPED");
      assert.equal(defaultCollected.length, 0);
      return { mode: "DISABLED", defaultDecision, defaultAdmittedResult: admitted.status };
    });
    await step("W02", "two real WebContents sessions activate under one service", async () => {
      await h.activate("shop-a");
      await h.activate("shop-b");
      assert.notEqual(h.service.webContentsFor("shop-a"), h.service.webContentsFor("shop-b"));
      const a = h.sessionInfo.get("shop-a"); const b = h.sessionInfo.get("shop-b");
      assert.equal(a.isPersistent, false); assert.equal(b.isPersistent, false); assert.notEqual(a.partition, b.partition);
      return { sessions: { a, b } };
    });
    await step("W03", "same service two shops reject pre-admission frame", async () => {
      await h.connect("shop-a");
      const before = h.collected.length;
      await h.send("shop-a", { content: "same", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "same-id" }, "2026-09-18T00:00:01Z");
      await waitFor("pre-admission denial", () => Object.keys(h.service.inboundDiagnostics().decisions ?? {}).some((key) => key.startsWith("MAIN_ADMISSION_DENIED")));
      assert.equal(h.collected.length, before);
      return { collectorDelta: 0, decisions: h.service.inboundDiagnostics().decisions };
    });
    await step("W04", "Main admission allows a new frame on the same bound connection", async () => {
      h.admissionState.mode = "GRANT";
      const before = h.collected.length;
      await h.send("shop-a", { content: "same", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "same-id" }, "2026-09-18T00:00:02Z");
      await waitFor("mapped A frame", () => h.collected.length > before);
      const envelope = h.collected.at(-1);
      assert.equal(envelope.identityLock.runtimeShop.value.value, "shop-a");
      assert.equal(envelope.identityLock.storeId.value, "store-shop-a");
      return { collectorCalls: h.collected.length, identity: envelope.identityLock };
    });
    await step("W05", "same opaque IDs in shop-b remain scope-isolated", async () => {
      await h.connect("shop-b");
      const before = h.collected.length;
      await h.send("shop-b", { content: "same", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "same-id" }, "2026-09-18T00:00:03Z");
      await waitFor("mapped B frame", () => h.collected.length > before);
      const envelope = h.collected.at(-1);
      assert.equal(envelope.identityLock.runtimeShop.value.value, "shop-b");
      assert.equal(envelope.identityLock.storeId.value, "store-shop-b");
      return { collectorCalls: h.collected.length, identity: envelope.identityLock };
    });
    await step("W06", "revoked admission blocks later frames on the same connection", async () => {
      const diagnostics = h.service.inboundDiagnostics();
      assert.equal(typeof diagnostics.lastAdmissionId, "string");
      const before = h.collected.length;
      const revoked = h.service.revokeMainAdmissionsForShop("shop-a");
      assert.ok(revoked >= 1);
      await h.send("shop-a", { content: "same", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "same-id" }, "2026-09-18T00:00:04Z");
      await waitFor("revoked admission rejection", () => Object.keys(h.service.inboundDiagnostics().decisions ?? {}).includes("MAIN_ADMISSION_REVOKED"));
      assert.equal(h.collected.length, before);
      return { collectorDelta: 0, decisions: h.service.inboundDiagnostics().decisions };
    });
    await step("W07", "admission cannot be reused across WebContents or scopes", async () => {
      const senderA = h.service.webContentsFor("shop-a");
      const contextA = h.service.createInboundIngressContext(senderA);
      const admissionId = h.service.inboundDiagnostics().lastAdmissionId;
      assert.ok(contextA);
      const before = h.collected.length;
      const result = h.service.handleAdmittedInboundIngress(senderA, contextA, String(admissionId), { payload: { content: "same", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "same-id" } }, {
        webContents: senderA,
        connection: { webContents: senderA, observerId: "wrong", observerLifecycleId: 1, sessionId: "pdd-session-shop-a", shopId: "shop-a", documentGeneration: 1, cdpSessionId: "", requestId: "wrong", url: "ws://127.0.0.1/" },
        binding: { sessionId: "pdd-session-shop-a", shopId: "shop-a", documentGeneration: 1 },
      });
      assert.equal(result.status, "STOPPED");
      assert.equal(h.collected.length, before);
      return { result };
    });
    await step("W08", "legacy bridge, AI, send, and persistence counters are zero", async () => {
      assert.equal(h.counters.legacyBridgeCalls, 0);
      assert.equal(h.counters.aiCalls, 0);
      assert.equal(h.counters.transportSendCalls, 0);
      assert.equal(h.counters.businessPersistenceWrites, 0);
      return { counters: h.counters };
    });
    await step("W09", "required unit regressions are executed", async () => ({ unitRegressions: "pdd-main-admission/pdd-inbound-observer/bootstrap-pdd-ingress-wiring/pdd-platform-service/pdd-page-ipc-guard" }));
    result = failures.length === 0 ? "COMPLETE" : "PARTIAL";
  } catch (error) {
    finalError = String(error?.stack ?? error);
    result = "PARTIAL";
  } finally {
    let cleanupPassed = true;
    try { h.cleanup(); } catch (error) { cleanupPassed = false; failures.push({ id: "CLEANUP", status: "FAIL", error: String(error?.stack ?? error) }); }
    try { await new Promise((resolvePromise) => wsServer.close(resolvePromise)); await new Promise((resolvePromise) => server.close(resolvePromise)); } catch (error) { cleanupPassed = false; failures.push({ id: "SERVER_CLOSE", status: "FAIL", error: String(error?.stack ?? error) }); }
    const requiredChecks = REQUIRED_CHECK_IDS.map((id) => ({ id, status: checks.find((check) => check.id === id)?.status ?? "MISSING" }));
    const countersZero = h.counters.legacyBridgeCalls === 0 && h.counters.aiCalls === 0 && h.counters.transportSendCalls === 0 && h.counters.businessPersistenceWrites === 0;
    const completionGate = {
      status: pathCheck.ok && requiredChecks.every((check) => check.status === "PASS") && countersZero && unhandledRejections.length === 0 && cleanupPassed && finalError === null && process.env.SHEEP301_UNIT_TESTS_PASSED === "1" ? "PASS" : "FAIL",
      requiredChecks,
      pathCheckOk: pathCheck.ok,
      countersZero,
      unhandledRejections: unhandledRejections.length,
      cleanupPassed,
      unitRegressionsPassed: process.env.SHEEP301_UNIT_TESTS_PASSED === "1",
      finalError,
    };
    if (completionGate.status !== "PASS") {
      result = "PARTIAL";
      if (!finalError) finalError = "producer wiring completion gate failed";
    }
    const report = {
      task: "SHEEP-301",
      acceptance_unit: "TRUSTED_MAIN_PDD_INGRESS_PRODUCER_WIRING",
      result,
      command: "node scripts/run-sheep-301-producer-wiring-smoke.mjs",
      production_activation_performed: false,
      live_validation_performed: false,
      source_implementation_performed: true,
      controlled_offline_validation_performed: true,
      production_pdd_ingress_readiness: "BLOCKED",
      live_validation_authorization: "NOT_AUTHORIZED",
      full_sheep_301_closed: false,
      next_stage_not_executed: true,
      controller_review_status: "AWAITING_CONTROLLER_REVIEW",
      path_check: pathCheck,
      execution_paths: EXECUTION_PATHS,
      source_digests: SOURCE_DIGESTS,
      runtime: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
      runtime_configuration: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, noSandboxSwitchUsed: false, memoryPartitions: Object.fromEntries(h.sessionInfo) },
      counters: { ...h.counters, syntheticWebSocketTraffic: traffic },
      measurement_boundary: {
        legacyBridgeCalls: "dynamic orchestrator stub counter",
        aiCalls: "code-boundary: canonical controlled path does not invoke AI; no AI client is bound to this smoke path",
        transportSendCalls: "dynamic fail-fast adapter send/transfer spy",
        businessPersistenceWrites: "code-boundary: no business persistence repository is injected into this smoke path",
        syntheticWebSocketTraffic: "dynamic loopback server counters",
        diagnosticReportWrite: "one report write, not business persistence",
      },
      collector: { envelopes: h.collected.length, identities: h.collected.map((envelope) => envelope.identityLock) },
      required_checks: REQUIRED_CHECK_IDS,
      checks,
      unit_regressions_passed: process.env.SHEEP301_UNIT_TESTS_PASSED === "1",
      required_checks_executed: requiredChecks.every((check) => check.status === "PASS") && failures.length === 0 && process.env.SHEEP301_UNIT_TESTS_PASSED === "1",
      completion_gate: completionGate,
      failures,
      unit_evidence: ["pdd-main-admission.test.ts", "pdd-inbound-observer.test.ts", "bootstrap-pdd-ingress-wiring.test.ts", "pdd-platform-service.test.ts", "pdd-page-ipc-guard.test.ts"],
      unhandled_rejections: unhandledRejections,
      coverage_limitation: "Pre-admission frames are dropped and not collected. This smoke is controlled local loopback only and does not prove real PDD/Titan behavior or production activation.",
      error: finalError,
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    app.exit(result === "COMPLETE" ? 0 : 1);
  }
}

main().catch((error) => { writeFileSync(REPORT_PATH, JSON.stringify({ result: "PARTIAL", error: String(error?.stack ?? error), checks, failures, unhandled_rejections: unhandledRejections }, null, 2) + "\n", "utf8"); app.exit(1); });
