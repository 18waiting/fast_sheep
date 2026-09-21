// SHEEP-303 enabled-path integration: the REAL composition, not the builder in isolation.
//
// Chain under test:
//   page event -> decoded-event adapter -> Main gate/mapper/validator -> canonical persistence (INGESTED)
//     -> Main onCanonicalInbound -> inboundTurns.ingest -> expiry driver -> onTurn sink
//
// Everything is offline and deterministic: FIXTURE navigation mode, an isolated SQLite database under
// a temp dir, an in-process fake page, an injected expiry scheduler and VirtualClock (no real sleep,
// no wall clock, no real page, no network, no AI, no send, no production write).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VirtualClock } from "@fastwork/test-kit";
import { deriveInternalConversationId } from "@fastwork/platform-pdd";
import {
  openDatabase,
  SqliteMessageRepository,
  SqliteNormalizedConversationRepository,
  SqlitePlatformAccountRepository,
  SqliteStoreRepository,
} from "@fastwork/persistence";
import { createMainContext } from "../dist/main/bootstrap.js";
import { PDD_DECODED_EVENT_OBSERVER_SOURCE } from "../dist/main/platforms/pdd/pdd-decoded-inbound-event-adapter.js";
import { createWorkspaceMerchantContext } from "../dist/main/services/workspace-merchant-context.js";
import { TURN_QUIET_WINDOW_DEFAULT_MS } from "../dist/main/services/inbound-turn-builder.js";

const SHOP_ID = "shop-integration-1";
const MERCHANT_ID = "merchant-integration-1";
const STORE_ID = "store-integration-1";
const ACCOUNT_ID = "account-integration-1";
const OPERATOR_UID = "1000000000003";
const CUSTOMER_A = "2318082461";
const CUSTOMER_B = "2318082470";
const resolution = (value) => (value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("waitFor timed out");
    await wait(10);
  }
}

class FakeView {
  visible = false;
  webContents;
  constructor() {
    const wc = { destroyed: false, send: () => {} };
    wc.isDestroyed = () => wc.destroyed;
    this.webContents = wc;
  }
  async loadLocalFixture() {}
  show() { this.visible = true; }
  hide() { this.visible = false; }
  setBounds() {}
  dispose() { this.webContents.destroyed = true; }
  setDocumentLifecycleObserver() {}
  startDocumentObservation() {}
  get isVisible() { return this.visible; }
}

/** Stateful fake page implementing the versioned adapter contract (install / setGeneration / drain / uninstall). */
function makeFakePage() {
  const page = {
    installed: false, events: [], dropped: 0, generation: null,
    async evaluate(expression) {
      if (expression === PDD_DECODED_EVENT_OBSERVER_SOURCE) { page.installed = true; return { ok: true, storeReachableVia: "fake-store" }; }
      const setGeneration = /setGeneration\((\d+)\)/.exec(expression);
      if (setGeneration) { page.generation = Number(setGeneration[1]); return page.generation; }
      if (expression.includes(".drain")) {
        const limitMatch = /drain\((\d+)\)/.exec(expression);
        const limit = limitMatch ? Number(limitMatch[1]) : page.events.length;
        return { events: page.events.splice(0, limit), remaining: page.events.length, dropped: page.dropped, mutationCounts: {} };
      }
      if (expression.includes(".uninstall")) { page.installed = false; return { ok: true }; }
      return null;
    },
  };
  return page;
}

function fakeScheduler() {
  let tick = null;
  const counts = { started: 0, stopped: 0 };
  return {
    scheduler: { start(onTick) { tick = onTick; counts.started += 1; }, stop() { counts.stopped += 1; tick = null; } },
    tickNow() { if (tick === null) throw new Error("scheduler not running"); tick(); },
    counts,
  };
}

function pageEvent(message, generation = 1) {
  return { mutation: "UPDATE_CHAT_LIST_ONE", pageDocumentGeneration: generation, message: { client_msg_id: null, ts: null, is_history: false, ...message } };
}

function messageInput(uid, msgId, content) {
  return { msg_id: msgId, type: 0, content, from: { role: "user", uid }, to: { role: "mall_cs", uid: OPERATOR_UID } };
}

function composeHarness({ aggregationEnabled, clock, driver, turns }) {
  const dir = mkdtempSync(join(tmpdir(), "fastwork-turn-integration-"));
  const db = openDatabase(join(dir, "db"), { seed: true });
  const conversations = new SqliteNormalizedConversationRepository(db.conn);
  const messages = new SqliteMessageRepository(db.conn);
  const stores = new SqliteStoreRepository(db.conn);
  const platformAccounts = new SqlitePlatformAccountRepository(db.conn);
  const page = makeFakePage();

  const context = createMainContext({
    testMode: true,
    conversationRepository: conversations,
    messageRepository: messages,
    storeRepository: stores,
    platformAccountRepository: platformAccounts,
    workspaceMerchant: createWorkspaceMerchantContext(MERCHANT_ID),
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => ({ granted: true, admissionId: "integration-grant" }) },
    decodeInboundFrame: (payloadData) => JSON.parse(payloadData),
    allowedInboundWebSocketUrl: () => true,
    createInboundObserver: () => ({
      observerId: "integration-observer",
      get isEnabled() { return true; },
      start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
      stop: () => undefined,
      snapshot: () => ({ observerId: "integration-observer", lifecycleId: 1, enabled: true, terminal: false }),
    }),
    makeView: () => new FakeView(),
    resolveInboundScope: () => ({
      merchantId: resolution(MERCHANT_ID), storeId: resolution(STORE_ID), platformAccountId: resolution(ACCOUNT_ID),
    }),
    resolveInboundIdentity: (message, document) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: { merchantId: resolution(MERCHANT_ID), storeId: resolution(STORE_ID), platformAccountId: resolution(ACCOUNT_ID) },
      runtimeConversationReference: resolution(undefined),
      association: message.customerUid === undefined || message.platformMessageId === undefined ? undefined : {
        ownerRuntimeShopId: document.shopId,
        ownerScope: { merchantId: resolution(MERCHANT_ID), storeId: resolution(STORE_ID), platformAccountId: resolution(ACCOUNT_ID) },
        platformCustomerId: message.customerUid,
        platformMessageId: message.platformMessageId,
        internalConversationId: resolution(deriveInternalConversationId({ platformAccountId: ACCOUNT_ID }, message.customerUid)),
        localMessageId: resolution("local-" + String(message.platformMessageId)),
      },
    }),
    decodedEventCapture: { enabled: true, evaluate: { evaluate: (expression) => page.evaluate(expression) }, maxMessagesPerDrain: 200 },
    ...(aggregationEnabled
      ? { inboundTurnAggregation: { enabled: true, quietWindowMs: TURN_QUIET_WINDOW_DEFAULT_MS, clock, scheduler: driver.scheduler, onTurn: (turn) => turns.push(turn) } }
      : {}),
  });

  async function activate() {
    db.conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES (?, ?)", MERCHANT_ID, "Integration merchant");
    db.conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES (?, ?, ?, ?)", STORE_ID, MERCHANT_ID, "Integration store", "pdd");
    db.conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform, external_ref) VALUES (?, ?, ?, ?)", ACCOUNT_ID, MERCHANT_ID, "pdd", SHOP_ID);
    await context.platform.activate(SHOP_ID);
    await waitFor(() => context.platform.inboundDiagnostics().observers.some((observer) => observer.shopId === SHOP_ID && observer.enabled === true));
    context.platform.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + SHOP_ID, shop_id: SHOP_ID }, context.platform.webContentsFor(SHOP_ID));
    await waitFor(() => context.platform.status(SHOP_ID)?.session_status === "READY");
    const started = await context.platform.startDecodedEventCapture(SHOP_ID);
    assert.equal(started.ok, true);
  }

  return {
    context, db, messages, conversations, page, activate,
    async drain() { return context.platform.drainDecodedEvents(SHOP_ID); },
    close() { try { context.inboundTurns.stop(); } catch { /* ignore */ } try { db.conn.close(); } catch { /* ignore */ } try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } },
  };
}

test("enabled path: canonical INGESTED -> onCanonicalInbound -> aggregation -> expiry driver -> onTurn", async () => {
  const clock = new VirtualClock();
  clock.set(1_800_000_000_000);
  const driver = fakeScheduler();
  const turns = [];
  const harness = composeHarness({ aggregationEnabled: true, clock, driver, turns });
  try {
    await harness.activate();
    const conversationA = deriveInternalConversationId({ platformAccountId: ACCOUNT_ID }, CUSTOMER_A);

    // Three consecutive messages from ONE customer (content is carried by the page event, never by an
    // out-of-band test array).
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000001", "你好")));
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000002", "我想问一下")));
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000003", "什么时候发货")));
    const drained = await harness.drain();
    assert.equal(drained.ingested, 3, "canonical persistence stored three messages");

    // The MAIN-level receipt is untouched by aggregation.
    assert.deepEqual({ ...harness.context.inboundReceipt }, { ingested: 3, duplicates: 0, rejected: 0, lastReason: null });
    assert.equal(harness.context.inboundTurnFailures.failures, 0);
    assert.equal(harness.context.inboundTurns.diagnostics().aggregatedMessages, 3);

    // The expiry driver emits the turn for the LAST message without any further message arriving.
    clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
    driver.tickNow();
    assert.equal(turns.length, 1, "exactly one turn reached the Main sink");
    const turn = turns[0];

    // Identity/scope came from the Main-authoritative envelope, not from page-supplied values.
    assert.deepEqual(turn.identity_lock, {
      platform: "pdd", merchantId: MERCHANT_ID, storeId: STORE_ID, platformAccountId: ACCOUNT_ID,
      conversationId: conversationA, customerId: CUSTOMER_A,
    });
    assert.equal(turn.source_message_ids.length, 3);
    // source_message_ids are the CANONICAL row ids from the receipt; content is read back from them.
    assert.deepEqual(turn.source_message_ids.map((id) => harness.messages.findById(id).contentText), ["你好", "我想问一下", "什么时候发货"]);
    assert.equal(turn.newness, "NEWNESS_UNVERIFIED");
    assert.equal(turn.automaticProcessingEligible, false);

    // observedAt was read back from the canonical persistence row (not invented at the sink).
    for (const [index, messageId] of turn.source_message_ids.entries()) {
      const row = harness.messages.findById(messageId);
      assert.ok(row, "the canonical row exists for " + messageId);
      assert.equal(turn.source_observed_at[index], row.observedAt, "observedAt came from the durable row");
      assert.equal(typeof row.observedAt, "string");
    }
  } finally { harness.close(); }
});

test("enabled path: multi-question content is read back complete, ordered and scope-consistent", async () => {
  const clock = new VirtualClock();
  clock.set(1_800_000_000_000);
  const driver = fakeScheduler();
  const turns = [];
  const harness = composeHarness({ aggregationEnabled: true, clock, driver, turns });
  try {
    await harness.activate();
    const questions = [
      ["1789911000101", "你好"],
      ["1789911000102", "我想问一下"],
      ["1789911000103", "什么时候发货"],
      ["1789911000104", "另外可以开发票吗"],
      ["1789911000105", "发顺丰吗"],
    ];
    for (const [messageId, content] of questions) harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, messageId, content)));
    await harness.drain();
    clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
    driver.tickNow();
    const turn = turns[0];

    assert.equal(turn.source_message_ids.length, questions.length, "message count is preserved");
    const conversation = harness.conversations.findById(turn.identity_lock.conversationId);
    assert.ok(conversation);
    for (const [index, messageId] of turn.source_message_ids.entries()) {
      const row = harness.messages.findById(messageId);
      // Content is recovered from the canonical persistence rows, in the turn's stable order.
      assert.equal(row.contentText, questions[index][1], "content read back verbatim for " + messageId);
      assert.equal(row.actor, "customer");
      assert.equal(row.contentKind, "text");
      assert.equal(row.occurredAt, null, "source time keeps its null semantics");
      // identity/scope consistency between the turn and the stored facts
      assert.equal(row.conversationId, turn.identity_lock.conversationId);
      assert.equal(conversation.storeId, turn.identity_lock.storeId);
      assert.equal(conversation.platformAccountId, turn.identity_lock.platformAccountId);
      assert.equal(conversation.merchantId, turn.identity_lock.merchantId);
    }
  } finally { harness.close(); }
});

test("enabled path: two customers never share a turn, and DUPLICATE produces no turn", async () => {
  const clock = new VirtualClock();
  clock.set(1_800_000_000_000);
  const driver = fakeScheduler();
  const turns = [];
  const harness = composeHarness({ aggregationEnabled: true, clock, driver, turns });
  try {
    await harness.activate();
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000201", "A1")));
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_B, "1789911000202", "B1")));
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000203", "A2")));
    const first = await harness.drain();
    assert.equal(first.ingested, 3);

    clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
    driver.tickNow();
    assert.equal(turns.length, 2, "two customers -> two turns");
    const byCustomer = new Map(turns.map((turn) => [turn.identity_lock.customerId, turn]));
    const contentsOf = (turn) => turn.source_message_ids.map((id) => harness.messages.findById(id).contentText);
    assert.deepEqual(contentsOf(byCustomer.get(CUSTOMER_A)), ["A1", "A2"], "customer A keeps only A messages, in order");
    assert.deepEqual(contentsOf(byCustomer.get(CUSTOMER_B)), ["B1"], "customer B keeps only B messages");
    assert.notEqual(byCustomer.get(CUSTOMER_A).identity_lock.conversationId, byCustomer.get(CUSTOMER_B).identity_lock.conversationId);

    // A re-delivered notification for an already stored message is a DUPLICATE: no new turn, no new row.
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000201", "A1")));
    const second = await harness.drain();
    assert.equal(second.ingested, 0);
    assert.equal(second.duplicates, 1, "drain result: " + JSON.stringify(second) + " diagnostics=" + JSON.stringify(harness.context.platform.decodedEventDiagnostics(SHOP_ID)?.counters));
    clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
    driver.tickNow();
    assert.equal(turns.length, 2, "DUPLICATE never creates a turn");
    assert.equal(harness.context.inboundTurns.diagnostics().droppedDuplicateReceipts, 1);
    assert.equal(harness.context.inboundTurnFailures.failures, 0, "no aggregation failure was recorded");
  } finally { harness.close(); }
});

test("default OFF: the same chain aggregates nothing and starts no expiry driver", async () => {
  const clock = new VirtualClock();
  clock.set(1_800_000_000_000);
  const driver = fakeScheduler();
  const turns = [];
  const harness = composeHarness({ aggregationEnabled: false, clock, driver, turns });
  try {
    await harness.activate();
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000301", "你好")));
    const drained = await harness.drain();
    assert.equal(drained.ingested, 1, "canonical persistence is unaffected by the aggregation switch");

    assert.equal(harness.context.inboundTurns.enabled, false);
    assert.equal(harness.context.inboundTurns.diagnostics().expiryDriver, "NONE", "the disabled switch starts no timer");
    assert.equal(harness.context.inboundTurns.diagnostics().aggregatedMessages, 0);
    assert.equal(harness.context.inboundTurns.diagnostics().emittedTurns, 0);
    assert.deepEqual(driver.counts, { started: 0, stopped: 0 });
    assert.deepEqual(turns, []);
    clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS * 5);
    assert.deepEqual(turns, [], "nothing can expire because nothing was aggregated");
    assert.deepEqual(harness.context.inboundTurns.turns(), []);
  } finally { harness.close(); }
});

test("side-effect surface: the aggregated turn cannot reach AI, send or production writes", async () => {
  const clock = new VirtualClock();
  clock.set(1_800_000_000_000);
  const driver = fakeScheduler();
  const turns = [];
  const harness = composeHarness({ aggregationEnabled: true, clock, driver, turns });
  try {
    await harness.activate();
    harness.page.events.push(pageEvent(messageInput(CUSTOMER_A, "1789911000401", "你好")));
    await harness.drain();
    clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
    driver.tickNow();

    const diagnostics = harness.context.inboundTurns.diagnostics();
    assert.equal(diagnostics.aiCalls, 0);
    assert.equal(diagnostics.sendCalls, 0);
    assert.equal(diagnostics.productionWrites, 0);
    assert.equal(diagnostics.sideEffectGuarantee, "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT");
    assert.equal(diagnostics.sinkFailures, 0);
    // Structural: the aggregation surface exposes no AI / send / persistence port.
    assert.deepEqual(Object.keys(harness.context.inboundTurns).sort(), ["diagnostics", "enabled", "ingest", "poll", "stop", "turns"]);
    assert.equal(turns[0].automaticProcessingEligible, false, "an aggregated turn is never automatically processable");
    assert.equal(Object.hasOwn(turns[0], "reply"), false);
    assert.equal(Object.hasOwn(turns[0], "prompt"), false);
  } finally { harness.close(); }
});
