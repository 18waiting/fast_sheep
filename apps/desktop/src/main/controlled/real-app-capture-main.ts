// SHEEP-301 controlled REAL receive -> isolated DB -> Fast Sheep UI (Main entry, env-gated).
//
// What this entry does (one controlled page startup, then passive observation):
//   authorized REAL PDD page (debug transport, read-side CDP only)
//     -> versioned decoded-event adapter installed INSIDE that page
//     -> real PddPlatformService controlled entry (start / drain / stop) in the REAL application
//        composition (Main identity + admission + mapper + default canonical validator)
//     -> isolated SQLite under REPO_ROOT/.tmp (this run only)
//     -> real typed IPC -> real sandboxed preload -> real renderer (Fast Sheep UI)
//
// Hard boundaries:
// - Only the CONFIGURED controlled test buyer's messages are persisted; anything else is refused
//   before persistence (scope UNKNOWN -> the canonical writer rejects it) and only counted.
// - No production DB write, no AI, no send, no platform interface call, no request replay, no
//   interception, no refresh/switch/scroll in the page, no auth material is read or exported.
// - No automatic action follows from a captured message: NEWNESS_UNVERIFIED and
//   sourceOccurredAt=null are preserved by the same pipeline the offline acceptance verified.
//
// Modes:
//   FASTWORK_SHEEP301_REAL_MODE=dry-run -> local fixture page instead of the real page: verifies the
//   whole wiring (composition, admission, adapter, drain, isolation, UI) without touching the shop.
//   FASTWORK_SHEEP301_REAL_MODE=real    -> the authorized real page (one controlled startup).

import { app, BrowserWindow, type WebContents } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  openDatabase,
  resolveDataRoot,
  SqliteMerchantRepository,
  SqliteMessageRepository,
  SqliteNormalizedConversationRepository,
  SqlitePlatformAccountRepository,
  SqliteStoreRepository,
  type PersistenceContext,
} from "@fastwork/persistence";
import { deriveInternalConversationId } from "@fastwork/platform-pdd";
import type { ConversationId, MerchantId, MessageId, PlatformAccountId, StoreId } from "@fastwork/domain";
import type { PddCanonicalIdentityBinding, PddCanonicalScopeBinding } from "@fastwork/platform-pdd";
import { IPC } from "@fastwork/desktop-ipc";
import { createMainContext, type BootstrapOptions, type MainContext } from "../bootstrap.js";
import { registerIpc, broadcast } from "../ipc/register-ipc.js";
import { createWorkspaceMerchantContext } from "../services/workspace-merchant-context.js";
import { PDD_PRODUCTION_CHAT_URL } from "../platforms/pdd/pdd-navigation-policy.js";
import type { PddViewHost } from "../platforms/pdd/pdd-view-host.js";
import type { PddInboundObserver } from "../platforms/pdd/pdd-inbound-observer.js";
import type { PddDocumentLifecycleObserver } from "../platforms/pdd/pdd-document-lifecycle.js";
import type { PddConnectionEvidence, PddMainAdmissionDecision, PddMainAdmissionProvider, PddMainAdmissionRequest } from "../platforms/pdd/pdd-main-admission.js";
import { openControlledPage, type ControlledPageTransport } from "./cdp-page-transport.js";
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

// Main-declared CONTROLLED canonical mapping + the Main-registered controlled runtime shop.
const SHOP_ID = process.env.FASTWORK_SHEEP301_REAL_SHOP_ID ?? "shop-1789408699210-9826";
const SHOP_NAME = "Controlled PDD Runtime (local only)";
const MERCHANT_ID = "merchant-real-observation-test";
const STORE_ID = "store-real-observation";
const ACCOUNT_ID = "account-real-observation";
/** Owner-confirmed controlled test buyer (evidence: the earlier baseline conversation rows). */
const TEST_BUYER_UID = process.env.FASTWORK_SHEEP301_REAL_TEST_BUYER_UID ?? "2318082461";
const CONTROLLED_URL = process.env.FASTWORK_SHEEP301_REAL_PAGE_URL ?? PDD_PRODUCTION_CHAT_URL;
const CDP_BASE_URL = process.env.FASTWORK_SHEEP301_REAL_CDP_URL ?? "http://127.0.0.1:9222";

const MODE = process.env.FASTWORK_SHEEP301_REAL_MODE === "dry-run" ? "dry-run" : "real";
/**
 * RUNNER POLICY (Controller close-out correction): re-binding an EXISTING target is refused until a
 * recovery design for "same target after termination" is reviewed and accepted. The approved
 * constraint (`R3C_TERMINAL_WEBCONTENTS_LIFECYCLE_CONSTRAINT`) is written against the WebContents
 * lifecycle and does not cover a cross-process rebind of an external CDP target, so the runner must
 * not do it. A controlled real run only ever creates its OWN target for this run.
 */
const REQUESTED_REUSE_TARGET_ID = process.env.FASTWORK_SHEEP301_REAL_REUSE_TARGET_ID ?? null;
const LABELS = (process.env.FASTWORK_SHEEP301_REAL_LABELS ?? "").split(",").map((value) => value.trim()).filter((value) => value.length > 0);
const WINDOW_TIMEOUT_MS = Number(process.env.FASTWORK_SHEEP301_REAL_TIMEOUT_MS ?? 1800000);
const STAGE_TIMEOUT_MS = Number(process.env.FASTWORK_SHEEP301_REAL_STAGE_TIMEOUT_MS ?? 90000);
const DRAIN_INTERVAL_MS = Number(process.env.FASTWORK_SHEEP301_REAL_DRAIN_INTERVAL_MS ?? 1500);

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) throw new Error("missing required env " + name);
  return value;
}

function containedTmpPath(name: string): string {
  const full = resolve(requiredEnv(name));
  if (full !== TMP_ROOT && !full.startsWith(TMP_ROOT + sep)) throw new Error(name + " must stay inside " + TMP_ROOT + " (got " + full + ")");
  return full;
}

const checks: Record<string, { ok: boolean; detail: unknown }> = {};
const failures: string[] = [];
function check(name: string, ok: boolean, detail: unknown): void {
  checks[name] = { ok, detail };
  if (!ok) failures.push(name);
}

// ---------------------------------------------------------------- controlled page channel

interface ChannelCounters {
  readonly commandsSent: Readonly<Record<string, number>>;
  readonly eventsReceived: number;
  readonly requestPaths: Readonly<Record<string, number>>;
  readonly commandErrors: number;
}

/** One page channel: either the authorized REAL page (CDP, read-side) or a local fixture page. */
interface ControlledPageChannel {
  readonly source: "REAL_PAGE" | "LOCAL_FIXTURE";
  readonly targetId: string | null;
  evaluate(expression: string): Promise<unknown>;
  currentDocument(): Promise<{ loaderId: string; url: string } | null>;
  counters(): ChannelCounters;
  markReadRequests(): number;
  emitFixtureMutation(type: string, payload: unknown): Promise<unknown>;
  navigate(): Promise<void>;
  /** True only for a page this run STARTED: a REUSED page is never navigated. */
  readonly shouldNavigate: boolean;
  closed(): boolean;
  close(): void;
}

const fixtureWindows: BrowserWindow[] = [];
function teardownFixtureWindows(): void {
  while (fixtureWindows.length > 0) {
    const win = fixtureWindows.pop();
    try { win?.destroy(); } catch { /* already gone */ }
  }
}

async function openFixtureChannel(): Promise<ControlledPageChannel> {
  const win = new BrowserWindow({
    width: 520, height: 360, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setBackgroundThrottling(false);
  fixtureWindows.push(win);
  await win.loadFile(FIXTURE_PAGE_HTML);
  let evaluates = 0;
  return {
    source: "LOCAL_FIXTURE",
    targetId: null,
    async evaluate(expression: string) { evaluates += 1; return win.webContents.executeJavaScript(expression); },
    async currentDocument() { return { loaderId: "local-fixture-document-1", url: FIXTURE_PAGE_HTML }; },
    counters() { return { commandsSent: { "fixture:evaluate": evaluates }, eventsReceived: 0, requestPaths: {}, commandErrors: 0 }; },
    markReadRequests: () => 0,
    async navigate() { throw new Error("the local fixture page is already loaded"); },
    shouldNavigate: false,
    closed: () => false,
    async emitFixtureMutation(type: string, payload: unknown) {
      return win.webContents.executeJavaScript("window.__fs301Fixture.emit(" + JSON.stringify(type) + "," + JSON.stringify(payload) + ")");
    },
    close() { /* fixture windows are torn down together at the end (see teardownFixtureWindows) */ },
  };
}

function realPageChannel(transport: ControlledPageTransport): ControlledPageChannel {
  return {
    source: "REAL_PAGE",
    targetId: transport.targetId,
    evaluate: (expression: string) => transport.evaluate(expression),
    currentDocument: () => transport.currentMainFrameDocument(),
    counters: () => transport.counters(),
    markReadRequests: () => transport.markReadRequests(),
    async emitFixtureMutation() { throw new Error("no fixture mutations on the real page"); },
    navigate: () => transport.navigate(),
    shouldNavigate: true,
    closed: () => transport.closed(),
    close: () => transport.close(),
  };
}

/**
 * Main-held document identity for the controlled page: the REAL main-frame loaderId reported by the
 * browser. The generation advances only for a DIFFERENT observed document, never in anticipation.
 */
class ControlledDocumentIdentity {
  private loaderId: string | null = null;
  private generation = 1;
  private observedDocuments = 0;
  private readonly history: Array<{ loaderIdSha8: string; url: string; generation: number }> = [];

  observe(document: { loaderId: string; url: string }): { advanced: boolean; isInitial: boolean; generation: number } {
    if (this.loaderId === document.loaderId) return { advanced: false, isInitial: false, generation: this.generation };
    const isInitial = this.loaderId === null;
    this.loaderId = document.loaderId;
    this.observedDocuments += 1;
    if (!isInitial) this.generation += 1;
    this.history.push({ loaderIdSha8: sha8(document.loaderId), url: document.url.split("?")[0], generation: this.generation });
    return { advanced: !isInitial, isInitial, generation: this.generation };
  }

  current(): number { return this.generation; }
  observed(): number { return this.observedDocuments; }
  documents(): ReadonlyArray<{ loaderIdSha8: string; url: string; generation: number }> { return this.history.map((entry) => ({ ...entry })); }
}

/** Main-held page facade: identity is this object; the page itself is the controlled channel. */
class ControlledPageFacade {
  readonly id = 1;
  private destroyed = false;
  constructor(private readonly channel: ControlledPageChannel) {}
  isDestroyed(): boolean { return this.destroyed; }
  executeJavaScript(expression: string): Promise<unknown> { return this.channel.evaluate(expression); }
  send(): void { /* this controlled run never uses the app page-IPC channel */ }
  markDestroyed(): void { this.destroyed = true; }
}

/** Controlled page view: provides the Main-held page/document binding, performs no navigation. */
class ControlledPageView {
  private observer: PddDocumentLifecycleObserver | null = null;
  private visible = false;
  constructor(readonly webContents: WebContents) {}
  setDocumentLifecycleObserver(observer: PddDocumentLifecycleObserver | null): void { this.observer = observer; }
  startDocumentObservation(): void { /* the real page is observed through the controlled channel */ }
  async loadLocalFixture(): Promise<void> { /* never used: this run never drives an app-side load */ }
  async loadProductionEntry(): Promise<void> { /* never used: the app never navigates the real page */ }
  setRouteDecisionHandler(): void { /* not applicable */ }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(): void { /* no bounds */ }
  dispose(): void { this.visible = false; }
  get isVisible(): boolean { return this.visible; }
  notifyMainFrameDocument(): void { this.observer?.onMainFrameNavigationStart(); }
  notifyDomReady(): void { this.observer?.onMainFrameDomReady(); }
}

/** Main-owned admission policy for this controlled run: real evidence, evaluated per drain. */
class ControlledPageAdmission implements PddMainAdmissionProvider {
  evaluateCount = 0;
  grantedCount = 0;
  readonly refusals: Record<string, number> = {};
  revokeReason: string | null = null;
  constructor(
    private readonly expectedFacade: WebContents,
    private readonly identityGeneration: () => number,
    private readonly isChannelLive: () => boolean,
  ) {}
  evaluate(request: PddMainAdmissionRequest): PddMainAdmissionDecision {
    this.evaluateCount += 1;
    const deny = (reason: string): PddMainAdmissionDecision => {
      this.refusals[reason] = (this.refusals[reason] ?? 0) + 1;
      return Object.freeze({ granted: false as const, reason });
    };
    if (this.revokeReason !== null) return deny(this.revokeReason);
    if (!this.isChannelLive()) return deny("PAGE_CHANNEL_CLOSED");
    if (request.webContents !== this.expectedFacade) return deny("PAGE_IDENTITY_MISMATCH");
    if (request.connection.shopId !== SHOP_ID) return deny("CONNECTION_SHOP_MISMATCH");
    if (request.connection.sessionId !== "pdd-session-" + SHOP_ID) return deny("CONNECTION_SESSION_MISMATCH");
    if (request.binding.shopId !== SHOP_ID) return deny("BINDING_SHOP_MISMATCH");
    if (request.binding.documentGeneration !== this.identityGeneration()) return deny("DOCUMENT_IDENTITY_MISMATCH");
    this.grantedCount += 1;
    return Object.freeze({ granted: true as const, admissionId: "controlled-real-capture" });
  }
}

function sha8(value: string): string {
  // Short digest for reporting only; never used as an identity.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------- Main-registered mapping checks

interface RegisteredShop { readonly id: string; readonly type: string; readonly name: string; readonly enabled: number; }

/** Read (never write) the app-registered controlled runtime shop from the app data root. */
function readRegisteredControlledShop(): { shop: RegisteredShop | null; dataRoot: string; reason: string | null } {
  const dataRoot = resolveDataRoot();
  const dbPath = join(dataRoot, "fast_sheep.sqlite3");
  if (!existsSync(dbPath)) return { shop: null, dataRoot, reason: "APP_DB_MISSING" };
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare("select id, type, name, enabled from shops").all() as unknown as RegisteredShop[];
      const pdd = rows.filter((row) => row.type === "pdd");
      if (pdd.length !== 1) return { shop: null, dataRoot, reason: pdd.length === 0 ? "NO_REGISTERED_PDD_SHOP" : "AMBIGUOUS_REGISTERED_PDD_SHOP" };
      return { shop: pdd[0], dataRoot, reason: null };
    } finally { db.close(); }
  } catch (error) {
    return { shop: null, dataRoot, reason: "APP_DB_READ_FAILED:" + String((error as { message?: unknown })?.message ?? error) };
  }
}

/** Ensure and VERIFY the controlled canonical scope rows in the isolated DB (association included). */
function ensureControlledMapping(db: PersistenceContext): { ok: boolean; detail: unknown } {
  const merchants = new SqliteMerchantRepository(db.conn);
  if (merchants.findById(MERCHANT_ID) === null) merchants.save({ id: MERCHANT_ID, name: "Observation TEST merchant" });
  const stores = new SqliteStoreRepository(db.conn);
  if (stores.findById(STORE_ID) === null) stores.save({ id: STORE_ID, merchantId: MERCHANT_ID, name: "controlled test store (TEST row)", platform: "pdd" });
  const accounts = new SqlitePlatformAccountRepository(db.conn);
  if (accounts.findById(ACCOUNT_ID) === null) accounts.save({ id: ACCOUNT_ID, merchantId: MERCHANT_ID, platform: "pdd", externalRef: SHOP_ID });

  const merchant = merchants.findById(MERCHANT_ID);
  const store = stores.findById(STORE_ID);
  const account = accounts.findById(ACCOUNT_ID);
  const associationOk = merchant !== null
    && store !== null && store.merchantId === MERCHANT_ID && store.platform === "pdd"
    && account !== null && account.merchantId === MERCHANT_ID && account.platform === "pdd" && account.externalRef === SHOP_ID;
  return {
    ok: associationOk,
    detail: {
      merchant: merchant === null ? null : merchant.id,
      store: store === null ? null : { id: store.id, merchantId: store.merchantId, platform: store.platform, name: store.name },
      platformAccount: account === null ? null : { id: account.id, merchantId: account.merchantId, platform: account.platform, externalRef: account.externalRef },
    },
  };
}

// ---------------------------------------------------------------- composition

function scopeBinding(): PddCanonicalScopeBinding {
  return {
    merchantId: { status: "RESOLVED", value: MERCHANT_ID as unknown as MerchantId },
    storeId: { status: "RESOLVED", value: STORE_ID as unknown as StoreId },
    platformAccountId: { status: "RESOLVED", value: ACCOUNT_ID as unknown as PlatformAccountId },
  };
}

interface ComposedCapture {
  readonly context: MainContext;
  readonly db: PersistenceContext;
  readonly view: ControlledPageView;
  readonly facade: ControlledPageFacade;
  readonly admission: ControlledPageAdmission;
  readonly dbPath: string;
  markChannelClosed(): void;
  dispose(): void;
}

function composeCapture(options: {
  dataDir: string;
  channel: ControlledPageChannel;
  identity: ControlledDocumentIdentity;
}): ComposedCapture {
  let channelClosed = false;
  const dbRoot = join(options.dataDir, "db");
  const db = openDatabase(dbRoot, { seed: true });
  const conversations = new SqliteNormalizedConversationRepository(db.conn);
  const messages = new SqliteMessageRepository(db.conn);
  const stores = new SqliteStoreRepository(db.conn);
  const platformAccounts = new SqlitePlatformAccountRepository(db.conn);

  const facade = new ControlledPageFacade(options.channel);
  const view = new ControlledPageView(facade as unknown as WebContents);
  const admission = new ControlledPageAdmission(facade as unknown as WebContents, () => options.identity.current(), () => !channelClosed);

  const bootstrapOptions: BootstrapOptions = {
    testMode: false,
    controlledProductionPddShop: { shop_id: SHOP_ID, name: SHOP_NAME, type: "pdd", enabled: true },
    conversationRepository: conversations,
    messageRepository: messages,
    storeRepository: stores,
    platformAccountRepository: platformAccounts,
    workspaceMerchant: createWorkspaceMerchantContext(MERCHANT_ID),
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: admission,
    createInboundObserver: () => controlledObserverStub(),
    allowedInboundWebSocketUrl: () => false,
    makeView: () => view as unknown as PddViewHost,
    resolveInboundScope: () => scopeBinding(),
    resolveInboundIdentity: (message): PddCanonicalIdentityBinding => {
      // Only the CONFIGURED controlled test buyer is in scope for this run. Any other customer gets an
      // explicitly UNKNOWN scope (no association), so the canonical writer refuses it before storage -
      // their content is never persisted and never displayed.
      if (message.customerUid !== TEST_BUYER_UID) {
        return {
          runtimeShop: { status: "UNKNOWN" },
          scope: { merchantId: { status: "UNKNOWN" }, storeId: { status: "UNKNOWN" }, platformAccountId: { status: "UNKNOWN" } },
          runtimeConversationReference: { status: "UNKNOWN" },
        };
      }
      const internalConversationId = deriveInternalConversationId({ platformAccountId: ACCOUNT_ID }, message.customerUid);
      const association = message.platformMessageId === undefined || internalConversationId === null
        ? undefined
        : {
          ownerRuntimeShopId: SHOP_ID,
          ownerScope: scopeBinding(),
          platformCustomerId: message.customerUid,
          platformMessageId: message.platformMessageId,
          internalConversationId: { status: "RESOLVED" as const, value: internalConversationId as unknown as ConversationId },
          localMessageId: { status: "RESOLVED" as const, value: ("local-" + message.platformMessageId) as unknown as MessageId },
        };
      return {
        runtimeShop: { status: "RESOLVED", value: { value: SHOP_ID } },
        scope: scopeBinding(),
        runtimeConversationReference: { status: "UNKNOWN" },
        ...(association ? { association } : {}),
      };
    },
    decodedEventCapture: {
      enabled: true,
      evaluate: { evaluate: (expression: string) => options.channel.evaluate(expression) },
      maxMessagesPerDrain: 200,
    },
  };

  const context = createMainContext(bootstrapOptions);
  return {
    context, db, view, facade, admission,
    dbPath: join(dbRoot, "fast_sheep.sqlite3"),
    markChannelClosed() { channelClosed = true; facade.markDestroyed(); },
    dispose() {
      facade.markDestroyed();
      try { db.conn.close(); } catch { /* ignore */ }
    },
  };
}

/** Controlled no-op observer seam: this run exercises the decoded-page-event path, not WS capture. */
function controlledObserverStub(): PddInboundObserver {
  const snapshot = { observerId: "sheep-301-real-app-capture", lifecycleId: 1, enabled: true, terminal: false };
  return {
    observerId: "sheep-301-real-app-capture",
    get isEnabled() { return true; },
    start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
    stop: () => undefined,
    snapshot: () => snapshot,
  } as unknown as PddInboundObserver;
}

// ---------------------------------------------------------------- renderer helpers

async function evaluateInPage<T>(webContents: WebContents, expression: string): Promise<T> {
  try {
    return (await webContents.executeJavaScript(expression, true)) as T;
  } catch (error) {
    throw new Error("PAGE_SCRIPT_FAILED expr=" + expression.slice(0, 160) + " :: " + String((error as { message?: unknown })?.message ?? error));
  }
}

async function waitForJs(webContents: WebContents, expression: string, timeoutMs = 20000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if ((await evaluateInPage<unknown>(webContents, "!!(" + expression + ")")) === true) return true; } catch { /* booting */ }
    if (Date.now() >= deadline) return false;
    await wait(150);
  }
}

const UI_SNAPSHOT_JS = `(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.timeline-message'));
  var storeSelect = document.querySelector('.conversation-list-scope-store');
  var active = document.querySelector('.conversation-active-id');
  var activeStore = document.querySelector('.conversation-active-store');
  return JSON.stringify({
    timelineRowCount: rows.length,
    timelineRows: rows.map(function (row) {
      var actor = row.querySelector('.timeline-actor');
      var time = row.querySelector('.timeline-time');
      var content = row.querySelector('.timeline-content');
      return { className: row.className, actor: actor ? actor.textContent : null, time: time ? time.textContent : null, content: content ? content.textContent : null };
    }),
    queueRowLabels: Array.prototype.slice.call(document.querySelectorAll('.conversation-list-row')).map(function (b) { return b.textContent; }),
    storeOptionLabels: storeSelect ? Array.prototype.map.call(storeSelect.options, function (o) { return o.textContent; }) : [],
    activeConversationText: active ? active.textContent : null,
    activeStoreText: activeStore ? activeStore.textContent : null
  });
})()`;

interface UiSnapshot {
  timelineRowCount: number;
  timelineRows: Array<{ className: string; actor: string | null; time: string | null; content: string | null }>;
  queueRowLabels: string[];
  storeOptionLabels: string[];
  activeConversationText: string | null;
  activeStoreText: string | null;
}

interface DbRowFacts { readonly contentText: string | null; readonly actor: string | null; readonly occurredAt: string | null; readonly observedAt: string | null; }

interface RunOutput {
  unit: string;
  mode: "real" | "dry-run";
  result: "PASS" | "PARTIAL" | "FAIL" | "REFUSED";
  startedAt: string;
  finishedAt: string;
  labels: readonly string[];
  environment: Record<string, unknown>;
  checks: Record<string, { ok: boolean; detail: unknown }>;
  failures: string[];
  readiness: Record<string, unknown>;
  counters: Record<string, unknown>;
  perLabel: Record<string, unknown>;
  ui: unknown;
  notes: readonly string[];
}

function buildOutput(input: {
  result: "PASS" | "PARTIAL" | "FAIL" | "REFUSED";
  startedAt: string;
  dataDir: string; resultFile: string; screenshotPath: string; statusFile: string;
  dbPath: string | null; finalizeReason: string;
  counters: Record<string, unknown>; perLabel: Record<string, unknown>; ui: UiSnapshot | null;
  readiness: Record<string, unknown>; notes: readonly string[];
}): RunOutput {
  return {
    unit: "SHEEP-301-REAL-APP-CAPTURE",
    mode: MODE,
    result: input.result,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    labels: LABELS,
    environment: {
      dataDir: input.dataDir, resultFile: input.resultFile, screenshot: input.screenshotPath, statusFile: input.statusFile,
      shopId: SHOP_ID, merchantId: MERCHANT_ID, storeId: STORE_ID, platformAccountId: ACCOUNT_ID,
      conversationId: CONVERSATION_ID, testBuyerUid: TEST_BUYER_UID, dbPath: input.dbPath,
      pageUrl: MODE === "dry-run" ? FIXTURE_PAGE_HTML : CONTROLLED_URL, cdpBaseUrl: MODE === "dry-run" ? null : CDP_BASE_URL,
      windowTimeoutMs: WINDOW_TIMEOUT_MS, finalizeReason: input.finalizeReason,
    },
    checks, failures, readiness: input.readiness, counters: input.counters, perLabel: input.perLabel, ui: input.ui,
    notes: input.notes,
  };
}

function runContextSnapshot(): { dataDir: string; resultFile: string; screenshotPath: string; statusFile: string } {
  return {
    dataDir: containedTmpPath("FASTWORK_SHEEP301_REAL_DATA_DIR"),
    resultFile: containedTmpPath("FASTWORK_SHEEP301_REAL_RESULT_FILE"),
    screenshotPath: containedTmpPath("FASTWORK_SHEEP301_REAL_SCREENSHOT"),
    statusFile: containedTmpPath("FASTWORK_SHEEP301_REAL_STATUS_FILE"),
  };
}

// ---------------------------------------------------------------- the run
const CONVERSATION_ID = "conversation:" + ACCOUNT_ID + ":" + TEST_BUYER_UID;

async function run(dataDir: string, resultFile: string, screenshotPath: string, statusFile: string): Promise<RunOutput> {
  const startedAt = new Date().toISOString();
  if (REQUESTED_REUSE_TARGET_ID !== null) {
    // Refused BEFORE any page action, database open, window creation or adapter install.
    const refusal = {
      policy: "REUSE_TARGET_REFUSED_UNTIL_RECOVERY_DESIGN_ACCEPTED",
      requestedTargetId: REQUESTED_REUSE_TARGET_ID,
      approvedConstraint: "R3C_TERMINAL_WEBCONTENTS_LIFECYCLE_CONSTRAINT (written against the WebContents lifecycle; no accepted cross-process same-target rebind design)",
      pageActionsTaken: 0, databaseOpened: false, windowCreated: false, adapterInstalled: false,
    };
    check("reuse_target_refused", true, refusal);
    return buildOutput({
      result: "REFUSED", startedAt, dataDir, resultFile, screenshotPath, statusFile,
      dbPath: null, finalizeReason: "REUSE_TARGET_REFUSED",
      counters: { reuseRefusal: refusal }, perLabel: {}, ui: null,
      readiness: { mode: MODE, refused: true, reason: "REUSE_TARGET_REFUSED", pageActionsTaken: 0 }, notes: [refusal.policy],
    });
  }
  const notes: string[] = [];
  const counters: Record<string, unknown> = {};
  let uiSnapshot: UiSnapshot | null = null;
  let readiness: Record<string, unknown> = {};
  let perLabel: Record<string, unknown> = {};
  let entry: ReturnType<typeof createControlledDecodedEventCaptureEntry> | null = null;
  let composed: ComposedCapture | null = null;
  let channel: ControlledPageChannel | null = null;
  let win: BrowserWindow | null = null;
  let finalizeReason = "NOT_FINALIZED";
  const stopped = { requested: false };
  const stopFile = join(dataDir, "stop.request");

  const persistStatus = (state: string, extra: Record<string, unknown> = {}) => {
    try {
      writeFileSync(statusFile, JSON.stringify({
        unit: "SHEEP-301-REAL-APP-CAPTURE", mode: MODE, state, at: new Date().toISOString(),
        labels: LABELS, conversationId: CONVERSATION_ID, counters, readiness, perLabel, ...extra,
      }, null, 2), "utf8");
    } catch { /* status is diagnostics */ }
  };

  const identity = new ControlledDocumentIdentity();
  try {
    // ---- 1. Main-registered controlled shop (read-only) + controlled canonical mapping ----
    const registered = readRegisteredControlledShop();
    check("registered_controlled_shop_present", registered.shop !== null && registered.reason === null, registered);
    check("registered_shop_matches_declared_mapping", registered.shop?.id === SHOP_ID && registered.shop?.type === "pdd", {
      registeredId: registered.shop?.id ?? null, expected: SHOP_ID,
    });

    // ---- 2. page channel (real page or local fixture) ----
    // The channel is opened BEFORE composing: the composed service needs it as its page evaluator, and
    // the facade/admission must refer to this exact channel object.
    let viewRef: ControlledPageView | null = null;
    let sessionDocumentsSeen = 0;
    // The session learns about a document ONLY from a REAL observed document (loaderId evidence); the
    // counter keeps the Main-held session generation equal to the observed document count.
    const reconcileDocumentIdentity = (): void => {
      const observed = identity.observed();
      while (sessionDocumentsSeen < observed) {
        viewRef?.notifyMainFrameDocument();
        sessionDocumentsSeen += 1;
      }
      if (observed > 0) viewRef?.notifyDomReady();
    };
    if (MODE === "dry-run") {
      channel = await openFixtureChannel();
    } else {
      const transport = await openControlledPage({
        cdpBaseUrl: CDP_BASE_URL,
        url: CONTROLLED_URL,
        observeNetwork: true,
        deferNavigation: true,
        onMainFrameDocument: (document) => {
          const outcome = identity.observe(document);
          reconcileDocumentIdentity();
          persistStatus("PAGE_DOCUMENT_OBSERVED", { generation: outcome.generation, advanced: outcome.advanced });
        },
      });
      channel = realPageChannel(transport);
    }
    check("page_channel_open", channel !== null, { source: channel.source, targetId: channel.targetId });
    counters.pageChannel = { source: channel.source, targetId: channel.targetId, url: MODE === "dry-run" ? FIXTURE_PAGE_HTML : CONTROLLED_URL };

    composed = composeCapture({ dataDir, channel, identity });
    viewRef = composed.view;
    // Documents observed before the view existed (attach happens first) are delivered now, once each.
    reconcileDocumentIdentity();
    const mapping = ensureControlledMapping(composed.db);
    check("controlled_canonical_mapping_verified", mapping.ok, mapping.detail);
    counters.mapping = mapping.detail;
    counters.dbPath = composed.dbPath;

    // ---- 3. real window + IPC + renderer on the ISOLATED database ----
    win = new BrowserWindow({
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
    const registeredChannels = registerIpc({
      orchestrator: composed.context.orchestratorHost,
      shops: composed.context.shops,
      worker: composed.context.worker,
      projection: composed.context.projection,
      coordinator: composed.context.coordinator,
      platformForShop: composed.context.platformForShop,
      revision: () => composed!.context.revision(),
      trustedWebContents: () => win!.webContents,
      contentBounds: () => ({ x: 0, y: 0, width: 1200, height: 800, visible: true }),
      jobs: composed.context.jobs,
      learning: composed.context.learning,
      review: composed.context.review,
      audit: composed.context.audit,
      optimization: composed.context.optimization,
      legacyImport: composed.context.legacyImport,
      conversations: composed.context.conversations,
      messages: composed.context.messages,
      stores: composed.context.stores,
      platformAccounts: composed.context.platformAccounts,
      workspaceMerchant: composed.context.workspaceMerchant,
    });
    composed.context.platformStatusSink.current = (ev) => broadcast(win!.webContents, IPC.platformStatusChanged, ev);
    await win.loadFile(RENDERER_HTML);
    const booted = await waitForJs(win.webContents, "document.body.dataset.booted === 'true'");
    check("renderer_booted", booted, { channels: registeredChannels.length, rendererConsole: rendererConsole.slice(-5) });
    const activation = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.activatePlatformShop({ shop_id: '" + SHOP_ID + "' }).then(function (r) { return JSON.stringify(r); })");
    check("controlled_shop_activated_via_ipc", typeof activation === "string" && activation.indexOf('"ok":true') >= 0, activation);

    // ---- 4. controlled page load + Main-held page/document binding ----
    // Navigation is issued AFTER the app composition and the view exist, so the session sees the real
    // navigation event; a REUSED page has no navigation event, so the live document is read back from
    // the browser (Page.getFrameTree loaderId) and delivered the same way.
    if (channel.shouldNavigate) await channel.navigate();
    const loadDeadline = Date.now() + STAGE_TIMEOUT_MS;
    while (Date.now() < loadDeadline) {
      const document = await channel.currentDocument().catch(() => null);
      if (document !== null) {
        if (document.url.indexOf("/chat-merchant/index.html") >= 0 || MODE === "dry-run") {
          identity.observe(document);
          reconcileDocumentIdentity();
          break;
        }
      }
      reconcileDocumentIdentity();
      await wait(500);
    }
    const facade = composed.facade as unknown as WebContents;
    const bindingBefore = composed.context.platform.status(SHOP_ID);
    const documentCount = identity.documents().length;
    check("main_held_document_identity_established", documentCount >= 1, { documents: identity.documents(), observedDocuments: identity.observed() });
    if (MODE === "real") {
      check("page_document_is_controlled_chat_route", identity.documents().some((document) => document.url.indexOf("/chat-merchant/index.html") >= 0), identity.documents());
    }
    check("main_held_page_facade_registered", composed.context.platform.webContentsFor(SHOP_ID) === facade, {
      hasFacade: composed.context.platform.webContentsFor(SHOP_ID) !== null, status: bindingBefore?.session_status ?? null,
    });

    // ---- 5. controlled capture: start + adapter install (bounded retry while the page boots) ----
    // The page observer can only install once the real page''s own store exists, so the controlled
    // entry is retried by creating a NEW entry per attempt (a new explicit Main decision each time) -
    // never by restarting a terminal entry.
    const installDeadline = Date.now() + STAGE_TIMEOUT_MS;
    let installAttempts = 0;
    const installReasons: string[] = [];
    let started: { ok: boolean; reason?: string } = { ok: false, reason: "NOT_ATTEMPTED" };
    while (Date.now() < installDeadline) {
      installAttempts += 1;
      entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: SHOP_ID, platform: composed.context.platform });
      started = await entry.start();
      if (started.ok === true) break;
      installReasons.push(String(started.reason ?? "UNKNOWN"));
      await wait(1500);
    }
    counters.installAttempts = installAttempts;
    counters.installReasons = installReasons;
    if (entry === null) throw new Error("controlled capture entry was never created");
    const capture = entry;
    const adapterState = await channel.evaluate("typeof window.__sheep301Adapter === 'object' && window.__sheep301Adapter !== null ? JSON.stringify(window.__sheep301Adapter.snapshot()) : 'NO_ADAPTER'");
    check("adapter_started", started.ok === true, { started, installAttempts, installReasons, pageDocument: identity.documents() });
    check("adapter_installed_in_page", typeof adapterState === "string" && adapterState.indexOf('"installed":true') >= 0, adapterState);

    const admitProbe = composed.admission.evaluateCount;
    const firstDrain = await capture.drain();
    check("drain_works", firstDrain.ok === true, firstDrain);
    check("admission_evaluated_for_drain", composed.admission.evaluateCount > admitProbe && composed.admission.grantedCount > 0, {
      evaluateCount: composed.admission.evaluateCount, grantedCount: composed.admission.grantedCount, refusals: composed.admission.refusals,
    });
    check("document_binding_generation_matches_real_document", composed.admission.grantedCount > 0 && (composed.admission.refusals.DOCUMENT_IDENTITY_MISMATCH ?? 0) === 0, {
      trackerGeneration: identity.current(), grantedCount: composed.admission.grantedCount, refusals: composed.admission.refusals,
    });
    counters.documentGeneration = identity.current();

    // ---- 6. query chain ready on THIS database ----
    const listJson = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.listConversations({ scope: { kind: 'all_stores' } }).then(function (r) { return JSON.stringify(r); })");
    const listProbe = JSON.parse(listJson) as { ok: boolean; data: { stores: Array<{ store_id: string; name: string }>; items: unknown[] } };
    check("query_chain_ready", listProbe.ok === true, { stores: listProbe.data.stores, items: listProbe.data.items.length });
    check("query_store_is_controlled_store", listProbe.data.stores.some((store) => store.store_id === STORE_ID), listProbe.data.stores);

    readiness = {
      mode: MODE,
      pageChannel: { source: channel.source, targetId: channel.targetId },
      documentIdentity: { generation: identity.current(), observedDocuments: identity.observed(), documents: identity.documents() },
      sessionStatus: composed.context.platform.status(SHOP_ID)?.session_status ?? null,
      sessionStatusAtBinding: bindingBefore?.session_status ?? null,
      adapterStarted: started.ok === true,
      adapterInstalled: typeof adapterState === "string" && adapterState.indexOf('"installed":true') >= 0,
      admission: { evaluateCount: composed.admission.evaluateCount, grantedCount: composed.admission.grantedCount, refusals: composed.admission.refusals },
      database: { dbPath: composed.dbPath, rows: composed.context.messages.listByConversation(CONVERSATION_ID).length },
      queryChainOk: listProbe.ok === true,
      captureState: capture.state(),
      conversationId: CONVERSATION_ID,
    };
    persistStatus(failures.length === 0 ? "CAPTURE_READY" : "READINESS_FAILED", { readiness });
    if (failures.length > 0) return buildOutput({ result: "FAIL", startedAt, dataDir, resultFile, screenshotPath, statusFile, dbPath: composed.dbPath, finalizeReason, counters, perLabel, ui: uiSnapshot, readiness, notes });

    // ---- 7. passive capture until the three labels arrive (or the window cap) ----
    // In dry-run mode the message source is the local fixture page: the declared labels are submitted
    // through the SAME page-mutation path so the whole wiring (adapter -> service -> DB -> UI) is
    // exercised locally, without touching the shop.
    if (MODE === "dry-run") {
      let sequence = 0;
      for (const label of LABELS) {
        sequence += 1;
        await channel.emitFixtureMutation("UPDATE_CHAT_LIST_ONE", {
          messageList: [{
            msg_id: "1789900001" + String(sequence).padStart(3, "0"),
            client_msg_id: null, type: 0, content: label, ts: null, is_history: false,
            from: { role: "user", uid: TEST_BUYER_UID }, to: { role: "mall_cs", uid: "1000000000003" },
          }],
        });
      }
      persistStatus("DRY_RUN_LABELS_SUBMITTED", { labels: LABELS });
    }

    const windowDeadline = Date.now() + WINDOW_TIMEOUT_MS;
    const labelSeenAt: Record<string, string> = {};
    let preExistingRows = 0;
    let lastRefresh = 0;
    while (Date.now() < windowDeadline) {
      if (stopped.requested || existsSync(stopFile)) { finalizeReason = "STOP_REQUESTED"; break; }
      if (channel.closed?.() === true) { finalizeReason = "PAGE_CHANNEL_CLOSED"; break; }
      const drained = await capture.drain();
      if (drained.ok !== true && drained.reason !== null) {
        if (String(drained.reason).startsWith("MAIN_ADMISSION_DENIED")) { finalizeReason = "ADMISSION_REFUSED:" + String(drained.reason); break; }
      }
      const rows = composed.context.messages.listByConversation(CONVERSATION_ID);
      const texts = rows.map((row) => row.contentText ?? "");
      for (const label of LABELS) {
        if (labelSeenAt[label] === undefined && texts.some((text) => text.indexOf(label) >= 0)) labelSeenAt[label] = new Date().toISOString();
      }
      if (labelSeenAt[LABELS[0]] !== undefined && preExistingRows === 0) {
        preExistingRows = rows.filter((row) => {
          const text = row.contentText ?? "";
          return !LABELS.some((label) => text.indexOf(label) >= 0);
        }).length;
      }
      if (Date.now() - lastRefresh > 4000) {
        lastRefresh = Date.now();
        await evaluateInPage<string>(win.webContents,
          "(function () { var s = document.querySelector('.conversation-list-scope-store'); if (!s) return 'NO_SELECT'; s.value = '__all_stores__'; s.dispatchEvent(new Event('change')); return 'DISPATCHED'; })()").catch(() => undefined);
        await evaluateInPage<string>(win.webContents,
          "(function () { var rows = document.querySelectorAll('.conversation-list-row'); if (rows.length) rows[0].click(); return rows.length; })()").catch(() => undefined);
      }
      persistStatus("CAPTURING", { labelSeenAt, rows: rows.length, drainTotal: capture.summary().drained });
      if (LABELS.every((label) => labelSeenAt[label] !== undefined)) { finalizeReason = "ALL_LABELS_CAPTURED"; break; }
      await wait(DRAIN_INTERVAL_MS);
    }
    if (finalizeReason === "NOT_FINALIZED") finalizeReason = "WINDOW_TIMEOUT";

    // ---- 8. evidence for the three target samples ----
    const rows = composed.context.messages.listByConversation(CONVERSATION_ID);
    const rowFacts: DbRowFacts[] = rows.map((row) => ({
      contentText: row.contentText ?? null, actor: row.actor ?? null, occurredAt: row.occurredAt ?? null, observedAt: row.observedAt ?? null,
    }));
    perLabel = Object.fromEntries(LABELS.map((label) => {
      const matching = rowFacts.filter((row) => (row.contentText ?? "").indexOf(label) >= 0);
      return [label, {
        databaseRows: matching.length,
        actor: matching.map((row) => row.actor),
        occurredAt: matching.map((row) => row.occurredAt),
        firstSeenAt: labelSeenAt[label] ?? null,
      }];
    }));
    const nonTargetRows = rowFacts.filter((row) => !LABELS.some((label) => (row.contentText ?? "").indexOf(label) >= 0));
    counters.inputs = { pageMessagesHandedToCollector: capture.summary().drained, collectorCalls: capture.summary().drained };
    counters.serviceCounters = composed.context.platform.decodedEventDiagnostics(SHOP_ID)?.counters ?? null;
    counters.inboundReceipt = composed.context.inboundReceipt;
    counters.database = { rows: rows.length, targetRows: rows.length - nonTargetRows.length, preExistingRows: nonTargetRows.length, nonTargetTexts: nonTargetRows.map((row) => row.contentText) };
    counters.ledger = composed.context.platform.decodedEventDiagnostics(SHOP_ID)?.ledgerSize ?? null;
    counters.pageRequests = channel.counters().requestPaths;
    counters.markReadRequestsObserved = channel.markReadRequests();
    counters.admission = { evaluateCount: composed.admission.evaluateCount, grantedCount: composed.admission.grantedCount, refusals: composed.admission.refusals };

    const finalListJson = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.listConversations({ scope: { kind: 'all_stores' } }).then(function (r) { return JSON.stringify(r); })");
    const finalList = JSON.parse(finalListJson) as { ok: boolean; data: { items: Array<{ conversation_id: string; store_id: string }>; stores: Array<{ store_id: string; name: string }> } };
    const finalTimelineJson = await evaluateInPage<string>(win.webContents,
      "window.fastworkDesktop.listConversationMessages({ conversation_id: " + JSON.stringify(CONVERSATION_ID) + " }).then(function (r) { return JSON.stringify(r); })");
    const finalTimeline = JSON.parse(finalTimelineJson) as { ok: boolean; data: { messages: Array<{ actor: string; content_text: string; occurred_at: string | null }> } };
    check("query_list_returns_controlled_conversation", finalList.ok === true && finalList.data.items.some((item) => item.conversation_id === CONVERSATION_ID && item.store_id === STORE_ID), finalList.data.items);
    check("query_timeline_returns_messages", finalTimeline.ok === true && finalTimeline.data.messages.length >= 1, { messages: finalTimeline.data.messages.length });
    counters.queryTimeline = { messages: finalTimeline.data.messages.length, actors: finalTimeline.data.messages.map((m) => m.actor), occurredAt: finalTimeline.data.messages.map((m) => m.occurred_at) };

    // UI: queue refresh + activate the controlled conversation, then capture the evidence.
    await evaluateInPage<string>(win.webContents,
      "(function () { var s = document.querySelector('.conversation-list-scope-store'); if (!s) return 'NO_SELECT'; s.value = '__all_stores__'; s.dispatchEvent(new Event('change')); return 'DISPATCHED'; })()");
    await waitForJs(win.webContents, "document.querySelectorAll('.conversation-list-row').length >= 1");
    await evaluateInPage<string>(win.webContents,
      "(function () { var rows = document.querySelectorAll('.conversation-list-row'); if (!rows.length) return 'NO_ROWS'; rows[0].click(); return 'CLICKED'; })()");
    const expectedUiRows = LABELS.length + nonTargetRows.length;
    await waitForJs(win.webContents, "document.querySelectorAll('.timeline-message').length >= " + String(expectedUiRows), 20000);
    await evaluateInPage<string>(win.webContents,
      "(function () { var host = document.querySelector('.conversation-timeline-host'); if (host) host.scrollIntoView({ block: 'start' }); return 'SCROLLED'; })()");
    await wait(500);
    uiSnapshot = JSON.parse(await evaluateInPage<string>(win.webContents, UI_SNAPSHOT_JS)) as UiSnapshot;
    const uiTexts = uiSnapshot.timelineRows.map((row) => row.content ?? "");
    for (const label of LABELS) {
      check("ui_visible_" + label, uiTexts.some((text) => text.indexOf(label) >= 0), uiTexts);
    }
    check("ui_attribution_identifiable", uiSnapshot.storeOptionLabels.length > 0
      && (uiSnapshot.activeConversationText ?? "").indexOf(CONVERSATION_ID) >= 0, {
      activeConversationText: uiSnapshot.activeConversationText, activeStoreText: uiSnapshot.activeStoreText, stores: uiSnapshot.storeOptionLabels,
    });
    const image = await win.webContents.capturePage();
    writeFileSync(screenshotPath, image.toPNG());
    const rectJson = await evaluateInPage<string>(win.webContents,
      "(function () { var el = document.querySelector('.message-timeline'); if (!el) return '{}'; var r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(r.width), height: Math.round(r.height) }); })()");
    const rect = JSON.parse(rectJson) as { x?: number; y?: number; width?: number; height?: number };
    if (typeof rect.width === "number" && rect.width > 0 && typeof rect.height === "number" && rect.height > 0) {
      const focused = await win.webContents.capturePage({ x: rect.x ?? 0, y: rect.y ?? 0, width: rect.width, height: rect.height });
      writeFileSync(screenshotPath.replace(/\.png$/, "") + "-timeline.png", focused.toPNG());
    }
    check("ui_screenshot_written", existsSync(screenshotPath), screenshotPath);

    const allLabelsCaptured = LABELS.every((label) => labelSeenAt[label] !== undefined);
    notes.push("capture counters: page messages handed to the collector = " + String(capture.summary().drained) + "; unique collected = " + String(counters.ledger ?? 0));
    notes.push("occurredAt stays null (page time semantics unverified); push_biz_context does not participate.");
    notes.push("the page's own requests are only counted, never intercepted or replayed; mark_read observed = " + String(channel.markReadRequests()));
    return buildOutput({ result: allLabelsCaptured ? "PASS" : "PARTIAL", startedAt, dataDir, resultFile, screenshotPath, statusFile, dbPath: composed.dbPath, finalizeReason, counters, perLabel, ui: uiSnapshot, readiness, notes });

  } finally {
    finalizeReason = finalizeReason === "NOT_FINALIZED" ? "ERROR_OR_ABORT" : finalizeReason;
    if (entry !== null) {
      const stoppedResult = await entry.stop().catch(() => ({ ok: false, reason: "STOP_FAILED" }));
      counters.finalize = { stop: stoppedResult, summary: entry.summary(), state: entry.state() };
    }
    if (channel !== null) channel.close();
    if (composed !== null) composed.markChannelClosed();
    persistStatus("FINALIZED", { finalizeReason });
    if (win !== null) { try { win.destroy(); } catch { /* ignore */ } }
    composed?.dispose();
    teardownFixtureWindows();
    try { if (existsSync(stopFile)) rmSync(stopFile); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------- Main entry (env-gated)

app.setName("fast_sheep");
app.setPath("userData", join(safeUserDataRoot(), "electron-user-data"));

/** userData stays inside the run root, and never outside REPO_ROOT/.tmp even if misconfigured. */
function safeUserDataRoot(): string {
  try { return containedTmpPath("FASTWORK_SHEEP301_REAL_DATA_DIR"); } catch { return TMP_ROOT; }
}

app.whenReady().then(async () => {
  const context = (() => { try { return runContextSnapshot(); } catch { return null; } })();
  try {
    if (LABELS.length === 0) throw new Error("missing required env FASTWORK_SHEEP301_REAL_LABELS (comma separated)");
    if (!existsSync(PRELOAD) || !existsSync(RENDERER_HTML)) throw new Error("desktop dist missing (build first)");
    if (!existsSync(FIXTURE_PAGE_HTML)) throw new Error("fixture page missing: " + FIXTURE_PAGE_HTML);
    if (context === null) throw new Error("run paths must be provided and stay inside " + TMP_ROOT);
    mkdirSync(context.dataDir, { recursive: true });
    mkdirSync(dirname(context.resultFile), { recursive: true });
    mkdirSync(dirname(context.screenshotPath), { recursive: true });
    const output = await run(context.dataDir, context.resultFile, context.screenshotPath, context.statusFile);
    writeFileSync(context.resultFile, JSON.stringify(output, null, 2), "utf8");
    console.log("REAL_APP_CAPTURE " + JSON.stringify({
      result: output.result, labels: output.labels, failures: output.failures,
      perLabel: output.perLabel, counters: output.counters, readiness: output.readiness,
      resultFile: context.resultFile, screenshot: context.screenshotPath,
    }));
    app.exit(output.result === "PASS" ? 0 : output.result === "REFUSED" ? 4 : output.result === "PARTIAL" ? 3 : 2);
  } catch (error) {
    const failure = {
      unit: "SHEEP-301-REAL-APP-CAPTURE", mode: MODE, result: "FAIL",
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      checks, failures, finishedAt: new Date().toISOString(),
    };
    if (context !== null) {
      try { mkdirSync(dirname(context.resultFile), { recursive: true }); writeFileSync(context.resultFile, JSON.stringify(failure, null, 2), "utf8"); } catch { /* ignore */ }
    }
    console.error("REAL_APP_CAPTURE_ERROR " + JSON.stringify(failure));
    app.exit(1);
  }
});
