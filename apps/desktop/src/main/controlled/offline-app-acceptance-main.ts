// SHEEP-301 controlled OFFLINE APPLICATION acceptance (Main only, env-gated, test-support).
//
// Purpose: run the REAL Fast Sheep application composition offline and show that the accepted
// controlled service chain reaches the real application UI:
//   real Main/bootstrap composition (createMainContext)
//     -> real PddPlatformService controlled entry (start / drain / stop)
//     -> real Main identity + admission + mapper + default canonical validator
//     -> real SQLite repositories (isolated test DB under REPO_ROOT/.tmp)
//     -> real typed IPC (registerIpc) -> real sandboxed preload -> real renderer
//
// Boundaries kept:
// - OFFLINE ONLY: requires FASTWORK_DESKTOP_TEST_MODE=1 (FIXTURE navigation) and refuses any data
//   directory outside REPO_ROOT/.tmp. No real PDD page, no network, no login state.
// - The message source is a LOCAL FIXTURE page (a real Chromium page inside this process) that only
//   dispatches the Vuex-style mutations the controlled observer subscribes to. No platform code is
//   loaded and no platform endpoint is contacted.
// - No AI, no send, no production DB write, no production enablement.

import { app, BrowserWindow, type WebContents } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  SqliteMessageRepository,
  SqliteNormalizedConversationRepository,
  SqlitePlatformAccountRepository,
  SqliteStoreRepository,
  SqliteWorkspaceIdentityBootstrap,
  resolveOrBootstrapWorkspaceMerchantId,
  type PersistenceContext,
} from "@fastwork/persistence";
import { deriveInternalConversationId } from "@fastwork/platform-pdd";
import type { ConversationId, MerchantId, MessageId, PlatformAccountId, StoreId } from "@fastwork/domain";
import type { PddCanonicalIdentityBinding, PddCanonicalScopeBinding } from "@fastwork/platform-pdd";
import { IPC } from "@fastwork/desktop-ipc";
import { createMainContext, type BootstrapOptions, type MainContext } from "../bootstrap.js";
import { registerIpc, broadcast } from "../ipc/register-ipc.js";
import { createWorkspaceMerchantContext } from "../services/workspace-merchant-context.js";
import type { PddViewHost } from "../platforms/pdd/pdd-view-host.js";
import type { PddInboundObserver } from "../platforms/pdd/pdd-inbound-observer.js";
import type { PddMainAdmissionDecision, PddMainAdmissionProvider } from "../platforms/pdd/pdd-main-admission.js";
import {
  createControlledDecodedEventCaptureEntry,
  CONTROLLED_CAPTURE_NOT_RUNNING,
  CONTROLLED_CAPTURE_NOT_STARTED,
} from "./decoded-event-capture-entry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..", "..");
const TMP_ROOT = join(REPO_ROOT, ".tmp");
const PRELOAD = join(REPO_ROOT, "apps", "desktop", "dist", "preload", "index.js");
const RENDERER_HTML = join(REPO_ROOT, "apps", "desktop", "dist", "renderer", "index.html");
const FIXTURE_PAGE_HTML = join(REPO_ROOT, "apps", "desktop", "tests", "fixtures", "sheep-301-decoded-event-page.html");

const SHOP_ID = "shop-test-1";
const STORE_ID = "store-" + SHOP_ID;
const ACCOUNT_ID = "account-" + SHOP_ID;
const STORE_LABEL_UI = "受控测试店铺A（SHEEP-301）";
const CUSTOMER_UID = "2318082461";
const OPERATOR_UID = "1000000000003";
const CONVERSATION_ID = "conversation:" + ACCOUNT_ID + ":" + CUSTOMER_UID;

/** Synthetic OFFLINE tags (deliberately different from the real captured tags). */
const MESSAGES = [
  { msgId: "1789900000201", content: "FS-APP-OFFLINE-1" },
  { msgId: "1789900000202", content: "FS-APP-OFFLINE-2" },
  { msgId: "1789900000203", content: "FS-APP-OFFLINE-3" },
];

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) throw new Error("missing required env " + name);
  return value;
}

function containedTmpPath(name: string): string {
  const full = resolve(requiredEnv(name));
  if (full !== TMP_ROOT && !full.startsWith(TMP_ROOT + sep)) {
    throw new Error(name + " must stay inside " + TMP_ROOT + " (got " + full + ")");
  }
  return full;
}
/** userData is placed inside the run root, and never outside REPO_ROOT/.tmp even if misconfigured. */
function safeUserDataRoot(): string {
  try { return containedTmpPath("FASTWORK_SHEEP301_OFFLINE_DATA_DIR"); } catch { return TMP_ROOT; }
}
// ---------------------------------------------------------------- evidence collection

const checks: Record<string, { ok: boolean; detail: unknown }> = {};
const failures: string[] = [];
function check(name: string, ok: boolean, detail: unknown): void {
  checks[name] = { ok, detail };
  if (!ok) failures.push(name);
}

// ---------------------------------------------------------------- local fixture page

interface FixturePage {
  readonly window: BrowserWindow;
  readonly webContents: WebContents;
  evaluate(expression: string): Promise<unknown>;
  emit(type: string, payload: unknown): Promise<unknown>;
  evaluateCount(): number;
  dispose(): void;
}

/** All fixture windows of this run; torn down together at the end (see FixturePage.dispose). */
const fixtureWindows: BrowserWindow[] = [];

function teardownFixtureWindows(): void {
  while (fixtureWindows.length > 0) {
    const win = fixtureWindows.pop();
    try { win?.destroy(); } catch { /* already gone */ }
  }
}

async function createFixturePage(): Promise<FixturePage> {
  const win = new BrowserWindow({
    width: 520, height: 360, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setBackgroundThrottling(false);
  fixtureWindows.push(win);
  win.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    console.error("FIXTURE_PAGE_LOAD_FAILED " + JSON.stringify({ code, description, url, isMainFrame }));
  });
  await win.loadFile(FIXTURE_PAGE_HTML);
  let evaluates = 0;
  return {
    window: win,
    webContents: win.webContents,
    async evaluate(expression: string) {
      evaluates += 1;
      return win.webContents.executeJavaScript(expression);
    },
    async emit(type: string, payload: unknown) {
      return win.webContents.executeJavaScript(
        "window.__fs301Fixture.emit(" + JSON.stringify(type) + "," + JSON.stringify(payload) + ")",
      );
    },
    evaluateCount: () => evaluates,
    // NOTE: the window is NOT destroyed here. In this Electron build a window destroyed before a
    // later loadFile makes that next load fail with ERR_FAILED, so fixture windows are torn down
    // together in teardownFixtureWindows() once every page has been loaded.
    dispose() { try { win.hide(); } catch { /* already gone */ } },
  };
}

function pageMessage(message: { msgId: string; content: string }): Record<string, unknown> {
  return {
    msg_id: message.msgId,
    client_msg_id: null,
    type: 0,
    content: message.content,
    ts: null,
    is_history: false,
    from: { role: "user", uid: CUSTOMER_UID },
    to: { role: "mall_cs", uid: OPERATOR_UID },
  };
}
// ---------------------------------------------------------------- fixture shop view + observer seam

/**
 * The shop view of this OFFLINE run is a local fixture: it exposes a real Chromium page as its
 * webContents (so the Main-held page identity is a real WebContents object) and never navigates.
 * The live-PDD page binding was proven in the earlier real-observation round; this run loads no
 * platform page at all.
 */
class LocalFixtureView {
  private visible = false;
  constructor(readonly webContents: WebContents) {}
  async loadLocalFixture(): Promise<void> { /* the fixture page is managed by the harness */ }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(): void { /* no bounds in this offline run */ }
  setDocumentLifecycleObserver(): void { /* the fixture page is not navigated */ }
  startDocumentObservation(): void { /* the fixture page is not navigated */ }
  dispose(): void { this.visible = false; }
  get isVisible(): boolean { return this.visible; }
}

/** Controlled no-op observer seam: this run exercises the decoded-page-event path, not WS capture. */
function stubInboundObserver(): PddInboundObserver {
  const snapshot = { observerId: "sheep-301-offline-acceptance", lifecycleId: 1, enabled: true, terminal: false };
  return {
    observerId: "sheep-301-offline-acceptance",
    get isEnabled() { return true; },
    start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
    stop: () => undefined,
    snapshot: () => snapshot,
  } as unknown as PddInboundObserver;
}

/** Main-owned admission switch for this run: flipped to prove a revocation blocks output. */
class MutableAdmission implements PddMainAdmissionProvider {
  granted = true;
  evaluateCount = 0;
  evaluate(): PddMainAdmissionDecision {
    this.evaluateCount += 1;
    return this.granted
      ? Object.freeze({ granted: true as const, admissionId: "controlled-offline-acceptance" })
      : Object.freeze({ granted: false as const, reason: "REVOKED_BY_ACCEPTANCE" });
  }
}
// ---------------------------------------------------------------- composition

/** Controlled scope mapping. The brand casts are contained here: this IS the controlled test mapping. */
function scopeBinding(workspaceMerchantId: string): PddCanonicalScopeBinding {
  return {
    merchantId: { status: "RESOLVED", value: workspaceMerchantId as unknown as MerchantId },
    storeId: { status: "RESOLVED", value: STORE_ID as unknown as StoreId },
    platformAccountId: { status: "RESOLVED", value: ACCOUNT_ID as unknown as PlatformAccountId },
  };
}

interface PreparedApp {
  readonly context: MainContext;
  readonly page: FixturePage;
  readonly db: PersistenceContext;
  readonly workspaceMerchantId: string;
  dispose(): void;
}

async function prepareApp(options: {
  dataDir: string;
  tag: string;
  captureEnabled: boolean;
  admission: MutableAdmission | null;
}): Promise<PreparedApp> {
  const page = await createFixturePage();
  const db = openDatabase(join(options.dataDir, "db-" + options.tag), { seed: true });
  const workspaceMerchantId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(db.conn));
  const conversations = new SqliteNormalizedConversationRepository(db.conn);
  const messages = new SqliteMessageRepository(db.conn);
  const stores = new SqliteStoreRepository(db.conn);
  const platformAccounts = new SqlitePlatformAccountRepository(db.conn);
  stores.save({ id: STORE_ID, merchantId: workspaceMerchantId, name: STORE_LABEL_UI, platform: "pdd" });
  platformAccounts.save({ id: ACCOUNT_ID, merchantId: workspaceMerchantId, platform: "pdd", externalRef: SHOP_ID });

  const bootstrapOptions: BootstrapOptions = {
    testMode: true,
    conversationRepository: conversations,
    messageRepository: messages,
    storeRepository: stores,
    platformAccountRepository: platformAccounts,
    workspaceMerchant: createWorkspaceMerchantContext(workspaceMerchantId),
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    createInboundObserver: () => stubInboundObserver(),
    allowedInboundWebSocketUrl: () => false,
    makeView: () => new LocalFixtureView(page.webContents) as unknown as PddViewHost,
    // Explicit controlled mapping: merchant = trusted workspace merchant; store + platform account
    // come from THIS run controlled mapping - the runtime Shop is never substituted for them.
    resolveInboundScope: () => scopeBinding(workspaceMerchantId),
    resolveInboundIdentity: (message, document): PddCanonicalIdentityBinding => {
      const internalConversationId = message.customerUid === undefined
        ? null
        : deriveInternalConversationId({ platformAccountId: ACCOUNT_ID }, message.customerUid);
      const association = message.customerUid === undefined || message.platformMessageId === undefined || internalConversationId === null
        ? undefined
        : {
          ownerRuntimeShopId: document.shopId,
          ownerScope: scopeBinding(workspaceMerchantId),
          platformCustomerId: message.customerUid,
          platformMessageId: message.platformMessageId,
          internalConversationId: { status: "RESOLVED" as const, value: internalConversationId as unknown as ConversationId },
          localMessageId: { status: "RESOLVED" as const, value: ("local-" + message.platformMessageId) as unknown as MessageId },
        };
      return {
        runtimeShop: { status: "RESOLVED", value: { value: document.shopId } },
        scope: scopeBinding(workspaceMerchantId),
        runtimeConversationReference: { status: "UNKNOWN" },
        ...(association ? { association } : {}),
      };
    },
  };
  if (options.captureEnabled) {
    bootstrapOptions.decodedEventCapture = {
      enabled: true,
      evaluate: { evaluate: (expression: string) => page.evaluate(expression) },
      maxMessagesPerDrain: 200,
    };
  }
  if (options.admission) bootstrapOptions.mainAdmissionProvider = options.admission;

  const context = createMainContext(bootstrapOptions);
  return {
    context, page, db, workspaceMerchantId,
    dispose() { page.dispose(); try { db.conn.close(); } catch { /* ignore */ } },
  };
}
// ---------------------------------------------------------------- renderer helpers

async function evaluateInPage<T>(webContents: WebContents, expression: string): Promise<T> {
  try {
    return (await webContents.executeJavaScript(expression, true)) as T;
  } catch (error) {
    // Body/UI read failures are reported with the exact stage and reason - never swallowed.
    throw new Error("PAGE_SCRIPT_FAILED expr=" + expression.slice(0, 160) + " :: "
      + String((error as { message?: unknown })?.message ?? error));
  }
}

async function waitForJs(webContents: WebContents, expression: string, timeoutMs = 20000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await evaluateInPage<unknown>(webContents, "!!(" + expression + ")")) === true) return true;
    } catch { /* page still booting */ }
    if (Date.now() >= deadline) return false;
    await wait(150);
  }
}

async function waitSessionReady(context: MainContext, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (context.platform.status(SHOP_ID)?.session_status === "READY") return true;
    if (Date.now() >= deadline) return false;
    await wait(100);
  }
}

const UI_SNAPSHOT_JS = `(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.timeline-message'));
  var storeSelect = document.querySelector('.conversation-list-scope-store');
  var active = document.querySelector('.conversation-active-id');
  var activeStore = document.querySelector('.conversation-active-store');
  var body = document.body ? document.body.innerText : '';
  return JSON.stringify({
    timelineRowCount: rows.length,
    timelineRows: rows.map(function (row) {
      var actor = row.querySelector('.timeline-actor');
      var time = row.querySelector('.timeline-time');
      var content = row.querySelector('.timeline-content');
      return {
        className: row.className,
        actor: actor ? actor.textContent : null,
        time: time ? time.textContent : null,
        content: content ? content.textContent : null
      };
    }),
    queueRowLabels: Array.prototype.slice.call(document.querySelectorAll('.conversation-list-row')).map(function (b) { return b.textContent; }),
    storeOptionLabels: storeSelect ? Array.prototype.map.call(storeSelect.options, function (o) { return o.textContent; }) : [],
    activeConversationText: active ? active.textContent : null,
    activeStoreText: activeStore ? activeStore.textContent : null,
    forbiddenLabelsPresent: ['\u5f85\u81ea\u52a8\u56de\u590d', '\u5df2\u89e3\u51b3', '\u81ea\u52a8\u56de\u590d\u4e2d'].filter(function (label) { return body.indexOf(label) >= 0; })
  });
})()`;

interface RunOutput {
  unit: string;
  result: "PASS" | "FAIL";
  startedAt: string;
  finishedAt: string;
  environment: Record<string, unknown>;
  counts: Record<string, unknown>;
  ui: unknown;
  checks: Record<string, { ok: boolean; detail: unknown }>;
  failures: string[];
  notes: readonly string[];
}
// ---------------------------------------------------------------- the acceptance run

async function run(): Promise<RunOutput> {
  const startedAt = new Date().toISOString();
  const dataDir = containedTmpPath("FASTWORK_SHEEP301_OFFLINE_DATA_DIR");
  const resultFile = containedTmpPath("FASTWORK_SHEEP301_OFFLINE_RESULT_FILE");
  const screenshotPath = containedTmpPath("FASTWORK_SHEEP301_OFFLINE_SCREENSHOT");
  if (!existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))) throw new Error("repo root not found at " + REPO_ROOT);
  if (!existsSync(FIXTURE_PAGE_HTML)) throw new Error("fixture page missing: " + FIXTURE_PAGE_HTML);
  if (!existsSync(PRELOAD) || !existsSync(RENDERER_HTML)) throw new Error("desktop dist missing (build first)");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(dirname(resultFile), { recursive: true });
  mkdirSync(dirname(screenshotPath), { recursive: true });

  const notes: string[] = [];
  const counts: Record<string, unknown> = {};
  let uiSnapshot: unknown = null;

  // ---- C0: DEFAULT OFF (no decodedEventCapture option at all) ----
  const defaultOff = await prepareApp({ dataDir, tag: "default-off", captureEnabled: false, admission: new MutableAdmission() });
  try {
    const start = await defaultOff.context.platform.startDecodedEventCapture(SHOP_ID);
    check("default_off_start_refused", start.ok === false && start.reason === "DECODED_EVENT_CAPTURE_DISABLED", start);
    check("default_off_no_page_interaction", defaultOff.page.evaluateCount() === 0, { pageEvaluates: defaultOff.page.evaluateCount() });
    counts.defaultOff = { start, pageEvaluates: defaultOff.page.evaluateCount() };
  } finally {
    defaultOff.dispose();
  }

  // ---- C1: capture enabled but the Main admission provider is MISSING ----
  const noAdmission = await prepareApp({ dataDir, tag: "no-admission", captureEnabled: true, admission: null });
  try {
    const activated = await noAdmission.context.coordinator.activateShop("pdd", SHOP_ID);
    check("missing_admission_shop_activated", activated === true, activated);
    noAdmission.context.platform.handlePageEvent(
      { event: "page_ready", session_id: "pdd-session-" + SHOP_ID, shop_id: SHOP_ID },
      noAdmission.context.platform.webContentsFor(SHOP_ID),
    );
    const ready = await waitSessionReady(noAdmission.context);
    check("missing_admission_session_ready", ready, noAdmission.context.platform.status(SHOP_ID));
    const entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: SHOP_ID, platform: noAdmission.context.platform });
    const started = await entry.start();
    await noAdmission.page.emit("UPDATE_CHAT_LIST_ONE", { messageList: [pageMessage({ msgId: "1789900000301", content: "FS-NO-ADMISSION-1" })] });
    const drained = await entry.drain();
    const rows = noAdmission.context.messages.listByConversation(CONVERSATION_ID).length;
    check("missing_admission_drain_refused", drained.ok === false && drained.reason === "MAIN_ADMISSION_PROVIDER_MISSING", drained);
    check("missing_admission_no_collector_no_write", drained.drained === 0 && rows === 0, { drained: drained.drained, rows });
    counts.missingAdmission = { started, drained, rows };
  } finally {
    noAdmission.dispose();
  }
  // ---- C2: the real application composition + real window / preload / renderer ----
  const admission = new MutableAdmission();
  const app1 = await prepareApp({ dataDir, tag: "app", captureEnabled: true, admission });
  const win = new BrowserWindow({
    width: 1200, height: 800, show: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setBackgroundThrottling(false);
  const rendererConsole: string[] = [];
  win.webContents.on("console-message", (event) => {
    const message = String((event as unknown as { message?: unknown }).message ?? "");
    rendererConsole.push(message);
    console.error("RENDERER_CONSOLE " + message);
  });
  const registered = registerIpc({
    orchestrator: app1.context.orchestratorHost,
    shops: app1.context.shops,
    worker: app1.context.worker,
    projection: app1.context.projection,
    coordinator: app1.context.coordinator,
    platformForShop: app1.context.platformForShop,
    revision: () => app1.context.revision(),
    trustedWebContents: () => win.webContents,
    contentBounds: () => ({ x: 0, y: 0, width: 1200, height: 800, visible: true }),
    jobs: app1.context.jobs,
    learning: app1.context.learning,
    review: app1.context.review,
    audit: app1.context.audit,
    optimization: app1.context.optimization,
    legacyImport: app1.context.legacyImport,
    conversations: app1.context.conversations,
    messages: app1.context.messages,
    stores: app1.context.stores,
    platformAccounts: app1.context.platformAccounts,
    workspaceMerchant: app1.context.workspaceMerchant,
  });
  app1.context.platformStatusSink.current = (ev) => broadcast(win.webContents, IPC.platformStatusChanged, ev);

  try {
    await win.loadFile(RENDERER_HTML);
    const booted = await waitForJs(win.webContents, "document.body.dataset.booted === 'true'");
    check("renderer_booted", booted, { channels: registered.length, rendererConsole: rendererConsole.slice(-5) });

    // Real renderer activation path (typed IPC -> coordinator -> PddPlatformService).
    const activation = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.activatePlatformShop({ shop_id: 'shop-test-1' }).then(function (r) { return JSON.stringify(r); })");
    check("shop_activated_via_ipc", typeof activation === "string" && activation.indexOf(String.fromCharCode(34) + "ok" + String.fromCharCode(34) + ":true") >= 0, activation);
    const sender = app1.context.platform.webContentsFor(SHOP_ID);
    check("main_held_page_binding_present", sender !== null && sender !== undefined, { hasWebContents: sender !== null });
    app1.context.platform.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + SHOP_ID, shop_id: SHOP_ID }, sender);
    const ready = await waitSessionReady(app1.context);
    check("session_ready_after_page_ready", ready, app1.context.platform.status(SHOP_ID));

    // Controlled entry (start -> drain* -> stop): Main-owned, explicitly enabled for THIS run only.
    const entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: SHOP_ID, platform: app1.context.platform });
    const beforeStart = await entry.drain();
    const pageEvaluatesBeforeStart = app1.page.evaluateCount();
    check("drain_before_start_refused", beforeStart.ok === false && beforeStart.reason === CONTROLLED_CAPTURE_NOT_STARTED, beforeStart);
    check("no_capture_before_start", pageEvaluatesBeforeStart === 0, { pageEvaluates: pageEvaluatesBeforeStart });

    const started = await entry.start();
    check("controlled_capture_started", started.ok === true, started);
    const install = await evaluateInPage<string>(app1.page.webContents, "JSON.stringify(window.__sheep301Adapter.snapshot())");
    check("page_observer_installed", typeof install === "string" && install.indexOf('"installed":true') >= 0, install);

    // ---- 9 inputs (3 synthetic messages x 3 submissions) drained through the real service ----
    const rounds: Array<{ round: number; drained: number; ingested: number; duplicates: number; remaining: number; diagnostics: readonly string[] }> = [];
    for (let round = 1; round <= 3; round += 1) {
      for (const message of MESSAGES) {
        await app1.page.emit("UPDATE_CHAT_LIST_ONE", { messageList: [pageMessage(message)] });
      }
      const drained = await entry.drain();
      rounds.push({ round, drained: drained.drained, ingested: drained.ingested, duplicates: drained.duplicates, remaining: drained.remaining, diagnostics: drained.diagnostics });
    }
    const summary = entry.summary();
    const rows = app1.context.messages.listByConversation(CONVERSATION_ID);
    const diagnostics = app1.context.platform.decodedEventDiagnostics(SHOP_ID);
    const counters = diagnostics?.counters as { drained?: number; ingested?: number; duplicates?: number; rejectedByGate?: number; rejectedByMain?: number } | undefined;
    counts.inputs = 9;
    counts.uniqueMessages = 3;
    counts.rounds = rounds;
    counts.entrySummary = summary;
    counts.serviceCounters = counters ?? null;
    counts.inboundReceipt = app1.context.inboundReceipt;
    counts.databaseRows = rows.length;
    check("round1_ingested_three", rounds[0]?.ingested === 3 && rounds[0]?.drained === 3, rounds[0]);
    check("rounds_2_and_3_are_duplicates", rounds[1]?.duplicates === 3 && rounds[2]?.duplicates === 3, [rounds[1], rounds[2]]);
    check("database_exactly_three_rows", rows.length === 3, { rows: rows.length, contents: rows.map((row) => row.contentText) });
    check("stored_texts_are_the_three_tags", rows.map((row) => row.contentText).sort().join("|") === MESSAGES.map((m) => m.content).sort().join("|"), rows.map((row) => row.contentText));
    check("stored_actor_customer", rows.every((row) => row.actor === "customer"), rows.map((row) => row.actor));
    check("stored_occurred_at_unknown", rows.every((row) => row.occurredAt === null), rows.map((row) => row.occurredAt));
    check("source_restriction_ledger_kept", diagnostics?.ledgerSize === 3 && counters?.ingested === 3 && counters?.duplicates === 6 && counters?.drained === 9, { ledgerSize: diagnostics?.ledgerSize, counters, ledgerHead: diagnostics?.ledger[0]?.entry ?? null });
    // ---- admission revoked: no collector call, no write ----
    admission.granted = false;
    await app1.page.emit("UPDATE_CHAT_LIST_ONE", { messageList: [pageMessage({ msgId: "1789900000302", content: "FS-REVOKED-APP-1" })] });
    const revoked = await entry.drain();
    const rowsAfterRevocation = app1.context.messages.listByConversation(CONVERSATION_ID).length;
    check("revoked_admission_drain_refused", revoked.ok === false && String(revoked.reason).startsWith("MAIN_ADMISSION_DENIED"), revoked);
    check("revoked_admission_no_collector_no_write", revoked.drained === 0 && rowsAfterRevocation === 3, { drained: revoked.drained, rows: rowsAfterRevocation });
    counts.revokedAdmission = { reason: revoked.reason, drained: revoked.drained, rows: rowsAfterRevocation };
    admission.granted = true;

    // ---- query read-back through the REAL preload/IPC path (renderer side) ----
    const listJson = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.listConversations({ scope: { kind: 'all_stores' } }).then(function (r) { return JSON.stringify(r); })");
    const list = JSON.parse(listJson) as { ok: boolean; data: { items: Array<{ conversation_id: string; store_id: string }>; stores: Array<{ store_id: string; name: string }> } };
    check("query_list_ok", list.ok === true && list.data.items.length === 1, list);
    check("query_list_store_attribution", list.data.items[0]?.store_id === STORE_ID, list.data.items[0]);
    check("query_list_store_name_resolved", list.data.stores.some((s) => s.store_id === STORE_ID && s.name === STORE_LABEL_UI), list.data.stores);
    const timelineJson = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.listConversationMessages({ conversation_id: " + JSON.stringify(CONVERSATION_ID) + " }).then(function (r) { return JSON.stringify(r); })");
    const timeline = JSON.parse(timelineJson) as { ok: boolean; data: { conversation_id: string; messages: Array<{ actor: string; content_text: string; occurred_at: string | null }> } };
    check("query_timeline_ok", timeline.ok === true && timeline.data.messages.length === 3, timeline);
    check("query_timeline_contents", timeline.data.messages.map((m) => m.content_text).sort().join("|") === MESSAGES.map((m) => m.content).sort().join("|"), timeline.data.messages.map((m) => m.content_text));
    counts.queryList = { items: list.data.items.length, store_id: list.data.items[0]?.store_id, stores: list.data.stores };
    counts.queryTimeline = { messages: timeline.data.messages.length, actors: timeline.data.messages.map((m) => m.actor), occurred_at: timeline.data.messages.map((m) => m.occurred_at) };

    // ---- real UI display (the actual Fast Sheep renderer) ----
    // The renderer booted BEFORE the messages were ingested, so the queue is re-queried through the
    // real UI scope control (same typed IPC path a user uses) instead of a page reload.
    const queueRefresh = await evaluateInPage<string>(win.webContents,
      "(function () { var s = document.querySelector('.conversation-list-scope-store'); if (!s) return 'NO_SCOPE_SELECT'; s.value = '__all_stores__'; s.dispatchEvent(new Event('change')); return 'DISPATCHED'; })()");
    const queueShown = await waitForJs(win.webContents, "document.querySelectorAll('.conversation-list-row').length >= 1");
    const queueDiagnostic = await evaluateInPage<string>(win.webContents,
      "(function () { var panel = document.querySelector('.conversation-list'); return panel ? panel.innerText.slice(0, 240) : 'NO_QUEUE_PANEL'; })()");
    check("ui_queue_row_shown", queueShown, { queueRefresh, queueDiagnostic });
    const clicked = await evaluateInPage<string>(win.webContents,
      "(function () { var rows = document.querySelectorAll('.conversation-list-row'); if (rows.length === 0) return 'NO_ROWS'; rows[0].click(); return 'CLICKED'; })()");
    check("ui_queue_row_clicked", clicked === "CLICKED", clicked);
    const timelineShown = await waitForJs(win.webContents, "document.querySelectorAll('.timeline-message').length === 3");
    check("ui_timeline_three_rows", timelineShown, null);
    await wait(400);
    const ui = JSON.parse(await evaluateInPage<string>(win.webContents, UI_SNAPSHOT_JS)) as {
      timelineRowCount: number;
      timelineRows: Array<{ className: string; actor: string | null; time: string | null; content: string | null }>;
      queueRowLabels: string[];
      storeOptionLabels: string[];
      activeConversationText: string | null;
      activeStoreText: string | null;
      forbiddenLabelsPresent: string[];
    };
    uiSnapshot = ui;
    check("ui_shows_three_messages", ui.timelineRowCount === 3, ui.timelineRowCount);
    check("ui_message_contents_complete", ui.timelineRows.map((r) => r.content).sort().join("|") === MESSAGES.map((m) => m.content).sort().join("|"), ui.timelineRows.map((r) => r.content));
    check("ui_customer_attribution", ui.timelineRows.every((r) => r.actor === "\u5ba2\u6237" && r.className.indexOf("timeline-message--customer") >= 0), ui.timelineRows.map((r) => r.className));
    check("ui_duplicate_notifications_not_new_rows", ui.timelineRowCount === 3 && ui.queueRowLabels.length === 1, { rows: ui.timelineRowCount, queue: ui.queueRowLabels });
    check("ui_store_and_conversation_identifiable", ui.storeOptionLabels.some((label) => label === STORE_LABEL_UI)
      && (ui.activeConversationText ?? "").indexOf(CONVERSATION_ID) >= 0
      && (ui.activeStoreText ?? "").indexOf(STORE_ID) >= 0, { storeOptionLabels: ui.storeOptionLabels, activeConversationText: ui.activeConversationText, activeStoreText: ui.activeStoreText });
    check("ui_no_unproven_status_labels", ui.forbiddenLabelsPresent.length === 0, ui.forbiddenLabelsPresent);

    const scrollResult = await evaluateInPage<string>(win.webContents,
      "(function () { var host = document.querySelector('.conversation-timeline-host') || document.querySelector('.message-timeline'); if (!host) return 'NO_TIMELINE_HOST'; host.scrollIntoView({ block: 'start' }); return 'SCROLLED'; })()");
    await wait(500);
    const rectJson = await evaluateInPage<string>(win.webContents,
      "(function () { var el = document.querySelector('.message-timeline'); if (!el) return '{}'; var r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(r.width), height: Math.round(r.height) }); })()");
    const image = await win.webContents.capturePage();
    writeFileSync(screenshotPath, image.toPNG());
    check("ui_screenshot_written", existsSync(screenshotPath), { path: screenshotPath, scrollResult, rect: rectJson });
    const rect = JSON.parse(rectJson) as { x?: number; y?: number; width?: number; height?: number };
    let timelineScreenshot: string | null = null;
    if (typeof rect.width === "number" && rect.width > 0 && typeof rect.height === "number" && rect.height > 0) {
      timelineScreenshot = screenshotPath.replace(/\.png$/, "") + "-timeline.png";
      const focused = await win.webContents.capturePage({
        x: rect.x ?? 0, y: rect.y ?? 0, width: rect.width, height: rect.height,
      });
      writeFileSync(timelineScreenshot, focused.toPNG());
    }
    check("ui_timeline_screenshot_written", timelineScreenshot !== null && existsSync(timelineScreenshot), timelineScreenshot);
    counts.timelineScreenshot = timelineScreenshot;
    // ---- finalize: stop the controlled capture and prove it is inert afterwards ----
    const stopped = await entry.stop();
    const adapterAfterStop = await evaluateInPage<string>(app1.page.webContents, "String(typeof window.__sheep301Adapter)");
    const drainAfterStop = await entry.drain();
    const stopAgain = await entry.stop();
    const rowsAfterStop = app1.context.messages.listByConversation(CONVERSATION_ID).length;
    check("controlled_capture_stopped", stopped.ok === true, stopped);
    check("page_observer_uninstalled", adapterAfterStop === "undefined", adapterAfterStop);
    check("drain_after_stop_refused", drainAfterStop.ok === false && drainAfterStop.reason === CONTROLLED_CAPTURE_NOT_RUNNING, drainAfterStop);
    check("stop_is_not_repeatable", stopAgain.ok === false && stopAgain.reason === CONTROLLED_CAPTURE_NOT_RUNNING, stopAgain);
    check("rows_unchanged_after_finalize", rowsAfterStop === 3, rowsAfterStop);
    counts.afterFinalize = { stopped, adapterAfterStop, drainAfterStop, stopAgain, rowsAfterStop, entrySummary: entry.summary() };
    notes.push("collector-facing messages = " + String(counters?.drained ?? 0) + " for 9 page submissions; the admission-revoked event was never drained and stayed in the fixture page buffer.");
    notes.push("occurredAt stays null (page time semantics unverified); push_biz_context is not part of this path.");
    notes.push("the ledger is an in-process diagnostic record of this service instance; the boundary of this slice is the isolated test DB plus the absence of any automatic consumer.");
  } finally {
    try { win.destroy(); } catch { /* ignore */ }
    app1.dispose();
  }

  teardownFixtureWindows();
  return {
    unit: "SHEEP-301-PDD-OFFLINE-APP-ACCEPTANCE",
    result: failures.length === 0 ? "PASS" : "FAIL",
    startedAt,
    finishedAt: new Date().toISOString(),
    environment: {
      testMode: process.env.FASTWORK_DESKTOP_TEST_MODE === "1",
      dataDir, resultFile, screenshot: screenshotPath,
      shopId: SHOP_ID, storeId: STORE_ID, platformAccountId: ACCOUNT_ID, conversationId: CONVERSATION_ID,
    },
    counts, ui: uiSnapshot, checks, failures, notes,
  };
}

// ---------------------------------------------------------------- Main entry (env-gated)

app.setName("fast_sheep");
app.setPath("userData", join(safeUserDataRoot(), "electron-user-data"));

app.whenReady().then(async () => {
  const resultFile = (() => { try { return containedTmpPath("FASTWORK_SHEEP301_OFFLINE_RESULT_FILE"); } catch { return null; } })();
  try {
    if (process.env.FASTWORK_DESKTOP_TEST_MODE !== "1") throw new Error("this acceptance requires FASTWORK_DESKTOP_TEST_MODE=1 (FIXTURE navigation, offline)");
    const output = await run();
    if (resultFile) writeFileSync(resultFile, JSON.stringify(output, null, 2), "utf8");
    console.log("OFFLINE_APP_ACCEPTANCE " + JSON.stringify({
      result: output.result,
      failures: output.failures,
      counts: output.counts,
      resultFile,
      screenshot: output.environment.screenshot,
    }));
    app.exit(output.result === "PASS" ? 0 : 2);
  } catch (error) {
    const failure = {
      unit: "SHEEP-301-PDD-OFFLINE-APP-ACCEPTANCE",
      result: "FAIL",
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      finishedAt: new Date().toISOString(),
    };
    if (resultFile) {
      try { mkdirSync(dirname(resultFile), { recursive: true }); writeFileSync(resultFile, JSON.stringify(failure, null, 2), "utf8"); } catch { /* ignore */ }
    }
    console.error("OFFLINE_APP_ACCEPTANCE_ERROR " + JSON.stringify(failure));
    app.exit(1);
  }
});
