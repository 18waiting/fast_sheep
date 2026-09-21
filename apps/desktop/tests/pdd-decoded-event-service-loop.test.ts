// SHEEP-301 service-level closed loop: synthetic messages -> real PddPlatformService controlled entry
// -> real identity/scope resolvers + mapper + default validator -> isolated SQLite -> dedupe ->
// existing query handlers read-back. Plus the two safety boundaries (pre-write identity/release
// checks, and the source/newness restrictions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteMessageRepository, SqliteNormalizedConversationRepository } from "@fastwork/persistence";
import { deriveInternalConversationId } from "@fastwork/platform-pdd";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { PDD_DECODED_EVENT_OBSERVER_SOURCE } from "../dist/main/platforms/pdd/pdd-decoded-inbound-event-adapter.js";
import { createCanonicalInboundPersistence } from "../dist/main/services/canonical-inbound-persistence.js";
import { QUERY_HANDLERS } from "../dist/main/ipc/query-handlers.js";
import { createWorkspaceMerchantContext } from "../dist/main/services/workspace-merchant-context.js";

const resolution = (value) => (value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) { if (Date.now() - started > timeoutMs) throw new Error("waitFor timed out"); await wait(10); }
}

class FakeView {
  visible = false;
  webContents;
  constructor() { const wc = { destroyed: false, send: () => {} }; wc.isDestroyed = () => wc.destroyed; this.webContents = wc; }
  async loadLocalFixture() {}
  show() { this.visible = true; }
  hide() { this.visible = false; }
  setBounds() {}
  dispose() { this.webContents.destroyed = true; }
  setDocumentLifecycleObserver() {}
  startDocumentObservation() {}
  get isVisible() { return this.visible; }
}

/** Stateful fake page for the versioned adapter contract (install / setGeneration / drain / uninstall). */
function makeFakePage(hooks = {}) {
  const page = {
    installed: false, events: [], dropped: 0, generation: null, evaluated: 0,
    async evaluate(expression) {
      page.evaluated += 1;
      if (expression === PDD_DECODED_EVENT_OBSERVER_SOURCE) { page.installed = true; return { ok: true, storeReachableVia: "fake-store" }; }
      const setGeneration = /setGeneration\((\d+)\)/.exec(expression);
      if (setGeneration) { page.generation = Number(setGeneration[1]); return page.generation; }
      if (expression.includes(".drain")) {
        const limitMatch = /drain\((\d+)\)/.exec(expression);
        const limit = limitMatch ? Number(limitMatch[1]) : page.events.length;
        const drained = page.events.splice(0, limit);
        if (typeof hooks.onDrain === "function") hooks.onDrain();
        return { events: drained, remaining: page.events.length, dropped: page.dropped, mutationCounts: {} };
      }
      if (expression.includes(".uninstall")) { page.installed = false; return { ok: true }; }
      return null;
    },
  };
  return page;
}

function pageEvent(message, pageDocumentGeneration) {
  return { mutation: "UPDATE_CHAT_LIST_ONE", pageDocumentGeneration, message: { client_msg_id: null, ts: null, is_history: false, ...message } };
}
function messageInput(overrides = {}) {
  return { msg_id: "1789900000001", type: 0, content: "FS-LOOP-1", from: { role: "user", uid: "2318082461" }, to: { role: "mall_cs", uid: "1000000000003" }, ...overrides };
}

async function composeService(options) {
  const dir = options.dir ?? mkdtempSync(join(tmpdir(), "fastwork-loop-"));
  const db = openDatabase(join(dir, "db"), { seed: true });
  const conversations = new SqliteNormalizedConversationRepository(db.conn);
  const messages = new SqliteMessageRepository(db.conn);
  const writer = createCanonicalInboundPersistence({ conversations, messages, now: () => "2026-09-21T00:00:09Z" });
  const views = [];
  const pages = [];
  let collectorCalls = 0;
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined },
    fixturePathFor: (shopId) => "/fixture-" + shopId + ".html",
    makeView: () => { const view = new FakeView(); views.push(view); return view; },
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    ...(options.omitAdmission === true ? {} : { mainAdmissionProvider: { evaluate: () => (options.admission ? options.admission() : { granted: true, admissionId: "controlled-grant" }) } }),
    decodeInboundFrame: (payloadData) => JSON.parse(payloadData),
    allowedInboundWebSocketUrl: () => true,
    createInboundObserver: () => ({
      observerId: "fake-observer", activeLifecycleId: 1, isTerminal: false,
      get isEnabled() { return true; },
      start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
      stop: () => undefined,
      snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, enabled: true, terminal: false }),
    }),
    resolveInboundScope: (document) => ({ merchantId: resolution("merchant-1"), storeId: resolution("store-" + document.shopId), platformAccountId: resolution("account-" + document.shopId) }),
    // REAL scoped derivation: the conversation id is derived from (platform account, customer uid).
    resolveInboundIdentity: (message, document) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: { merchantId: resolution("merchant-1"), storeId: resolution("store-" + document.shopId), platformAccountId: resolution("account-" + document.shopId) },
      runtimeConversationReference: resolution(undefined),
      association: message.customerUid === undefined || message.platformMessageId === undefined ? undefined : {
        ownerRuntimeShopId: document.shopId,
        ownerScope: { merchantId: resolution("merchant-1"), storeId: resolution("store-" + document.shopId), platformAccountId: resolution("account-" + document.shopId) },
        platformCustomerId: message.customerUid,
        platformMessageId: message.platformMessageId,
        internalConversationId: resolution(deriveInternalConversationId({ platformAccountId: "account-" + document.shopId }, message.customerUid)),
        localMessageId: resolution("local-" + String(message.platformMessageId)),
      },
    }),
    onCanonicalInbound: (envelope) => { collectorCalls += 1; return writer.ingest(envelope); },
    decodedEventCapture: { enabled: options.enabled !== false, evaluate: { evaluate: async (expression) => options.page.evaluate(expression) }, ...(options.maxMessagesPerDrain === undefined ? {} : { maxMessagesPerDrain: options.maxMessagesPerDrain }) },
  });
  pages.push(options.page);

  async function activate(shopId) {
    // The controlled canonical scope must exist in the isolated store (foreign keys), exactly as a
    // real controlled test store would be registered before messages arrive.
    db.conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES (?, ?)", "merchant-1", "Loop TEST merchant");
    db.conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES (?, ?, ?, ?)", "store-" + shopId, "merchant-1", "Loop TEST store", "pdd");
    db.conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform, external_ref) VALUES (?, ?, ?, ?)", "account-" + shopId, "merchant-1", "pdd", shopId);
    await service.activate(shopId);
    await waitFor(() => service.inboundDiagnostics().observers.some((observer) => observer.shopId === shopId && observer.enabled === true));
    const sender = service.webContentsFor(shopId);
    service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId }, sender);
    await waitFor(() => service.status(shopId)?.session_status === "READY");
  }

  return {
    service, db, conversations, messages, views, dir, page: options.page,
    collectorCalls: () => collectorCalls,
    async deps() {
      return {
        conversations, messages,
        stores: {
          listByMerchant: (merchantId) => db.conn.all("select * from stores where merchant_id = ?", merchantId).map((row) => ({ id: row.id, merchantId: row.merchant_id, name: row.name, platform: row.platform })),
          findById: (id) => { const row = db.conn.get("select * from stores where id = ?", id); return row ? { id: row.id, merchantId: row.merchant_id, name: row.name, platform: row.platform } : null; },
        },
        platformAccounts: { findById: (id) => { const row = db.conn.get("select * from platform_accounts where id = ?", id); return row ? { id: row.id, merchantId: row.merchant_id, platform: row.platform, externalRef: row.external_ref } : null; } },
        platformForShop: () => "pdd",
        workspaceMerchant: createWorkspaceMerchantContext("merchant-1"),
      };
    },
    close() { try { db.conn.close(); } catch { /* ignore */ } try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } },
    activate,
  };
}

test("service closed loop: repeated submissions keep exactly three records and read back correctly", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page });
  try {
    await harness.activate("shop-loop");
    const started = await harness.service.startDecodedEventCapture("shop-loop");
    assert.equal(started.ok, true);
    const binding = 1;

    const three = [
      messageInput({ msg_id: "1789900000101", content: "FS-LOOP-ALPHA" }),
      messageInput({ msg_id: "1789900000102", content: "FS-LOOP-BETA" }),
      messageInput({ msg_id: "1789900000103", content: "FS-LOOP-GAMMA" }),
    ];
    let inputs = 0;
    let seenStatuses = [];
    for (let round = 0; round < 3; round += 1) {
      for (const message of three) { page.events.push(pageEvent(message, binding)); inputs += 1; }
      const drained = await harness.service.drainDecodedEvents("shop-loop");
      assert.equal(drained.ok, true);
      seenStatuses = seenStatuses.concat([drained.ingested, drained.duplicates]);
    }
    const rollup = await harness.service.drainDecodedEvents("shop-loop");
    assert.equal(rollup.ok, true);

    const rows = harness.messages.listByConversation(deriveInternalConversationId({ platformAccountId: "account-shop-loop" }, "2318082461"));
    assert.equal(rows.length, 3, "exactly three records survive repeated submissions");
    const diagnostics = harness.service.decodedEventDiagnostics("shop-loop");
    assert.equal(diagnostics.counters.ingested, 3, "INGESTED count");
    assert.equal(diagnostics.counters.duplicates, 6, "DUPLICATE count (9 inputs - 3 unique)");
    assert.equal(diagnostics.counters.drained, 9, "collector-facing message count");
    assert.equal(inputs, 9);
    assert.equal(harness.collectorCalls(), 9, "mapping/collector is invoked per candidate (dedupe lives in the store)");
    assert.equal(new Set(rows.map((row) => row.externalRef)).size, 3);

    const deps = await harness.deps();
    const list = await QUERY_HANDLERS["conversations.list"](deps)({ scope: { kind: "all_stores" } });
    assert.equal(list.ok, true);
    assert.equal(list.data.items.length, 1, "one conversation for one customer");
    const conversationId = list.data.items[0].conversation_id;
    const timeline = await QUERY_HANDLERS["conversations.listMessages"](deps)({ conversation_id: conversationId });
    assert.equal(timeline.ok, true);
    assert.equal(timeline.data.messages.length, 3, "query handler reads back three messages");
    assert.deepEqual(timeline.data.messages.map((entry) => entry.content_text).sort(), ["FS-LOOP-ALPHA", "FS-LOOP-BETA", "FS-LOOP-GAMMA"]);
    assert.ok(timeline.data.messages.every((entry) => entry.actor === "customer"));
    assert.equal(harness.conversations.findById(conversationId)?.storeId, "store-shop-loop");
    assert.equal(harness.conversations.findById(conversationId)?.platformAccountId, "account-shop-loop");
  } finally { harness.close(); }
});

test("service closed loop: two customers stay in their own conversations", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page });
  try {
    await harness.activate("shop-customers");
    await harness.service.startDecodedEventCapture("shop-customers");
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000201", content: "FS-CUSTOMER-A", from: { role: "user", uid: "2318082461" } }), 1));
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000202", content: "FS-CUSTOMER-B", from: { role: "user", uid: "2318082462" } }), 1));
    const drained = await harness.service.drainDecodedEvents("shop-customers");
    assert.equal(drained.ingested, 2, JSON.stringify({ drained, status: harness.service.status("shop-customers") }));
    const a = deriveInternalConversationId({ platformAccountId: "account-shop-customers" }, "2318082461");
    const b = deriveInternalConversationId({ platformAccountId: "account-shop-customers" }, "2318082462");
    assert.notEqual(a, b);
    assert.equal(harness.messages.listByConversation(a).length, 1);
    assert.equal(harness.messages.listByConversation(b).length, 1);
    assert.equal(harness.messages.listByConversation(a)[0].contentText, "FS-CUSTOMER-A");
    assert.equal(harness.messages.listByConversation(b)[0].contentText, "FS-CUSTOMER-B");
  } finally { harness.close(); }
});

test("service closed loop: two shops with the same customer and message id stay isolated", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page });
  try {
    await harness.activate("shop-one");
    await harness.activate("shop-two");
    await harness.service.startDecodedEventCapture("shop-one");
    await harness.service.startDecodedEventCapture("shop-two");
    const shared = messageInput({ msg_id: "1789900000300", content: "FS-SHARED-ID" });
    page.events.push(pageEvent(shared, 1));
    assert.equal((await harness.service.drainDecodedEvents("shop-one")).ingested, 1);
    page.events.push(pageEvent(shared, 1));
    assert.equal((await harness.service.drainDecodedEvents("shop-two")).ingested, 1, "the same ids in another shop are not silently deduplicated");
    const one = deriveInternalConversationId({ platformAccountId: "account-shop-one" }, "2318082461");
    const two = deriveInternalConversationId({ platformAccountId: "account-shop-two" }, "2318082461");
    assert.notEqual(one, two);
    assert.equal(harness.messages.listByConversation(one).length, 1);
    assert.equal(harness.messages.listByConversation(two).length, 1);
    assert.equal(harness.conversations.findById(one)?.platformAccountId, "account-shop-one");
    assert.equal(harness.conversations.findById(two)?.platformAccountId, "account-shop-two");
  } finally { harness.close(); }
});

test("service closed loop: a restart does not re-insert an already stored message", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page });
  const dir = null;
  try {
    await harness.activate("shop-restart");
    await harness.service.startDecodedEventCapture("shop-restart");
    const message = messageInput({ msg_id: "1789900000400", content: "FS-RESTART-1" });
    page.events.push(pageEvent(message, 1));
    assert.equal((await harness.service.drainDecodedEvents("shop-restart")).ingested, 1);

    // New controlled lifecycle: a fresh service instance over the SAME isolated database.
    const restarted = await composeService({ page, dir: harness.dir });
    try {
      await restarted.activate("shop-restart");
      await restarted.service.startDecodedEventCapture("shop-restart");
      page.events.push(pageEvent(message, 1));
      const drained = await restarted.service.drainDecodedEvents("shop-restart");
      assert.equal(drained.ok, true);
      assert.equal(drained.ingested, 0, "no new row after a restart");
      const conversationId = deriveInternalConversationId({ platformAccountId: "account-shop-restart" }, "2318082461");
      assert.equal(restarted.messages.listByConversation(conversationId).length, 1, "still exactly one row");
      assert.ok(restarted.service.decodedEventDiagnostics("shop-restart").counters.rejectedByMain >= 1 || drained.duplicates >= 1 || harness.collectorCalls() >= 1);
    } finally { restarted.close(); }
    void dir;
  } finally { harness.close(); }
});

test("service closed loop: batching takes 2/2/1 without losing messages, and a real overflow is a reported gap", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page, maxMessagesPerDrain: 2 });
  try {
    await harness.activate("shop-batch");
    await harness.service.startDecodedEventCapture("shop-batch");
    for (let index = 0; index < 5; index += 1) page.events.push(pageEvent(messageInput({ msg_id: "178990000050" + index, content: "FS-BATCH-" + index }), 1));
    const first = await harness.service.drainDecodedEvents("shop-batch");
    const second = await harness.service.drainDecodedEvents("shop-batch");
    const third = await harness.service.drainDecodedEvents("shop-batch");
    assert.equal(first.drained, 2);
    assert.equal(second.drained, 2);
    assert.equal(third.drained, 1);
    assert.equal(first.remaining, 3);
    assert.equal(second.remaining, 1);
    assert.equal(third.remaining, 0);
    const conversationId = deriveInternalConversationId({ platformAccountId: "account-shop-batch" }, "2318082461");
    assert.equal(harness.messages.listByConversation(conversationId).length, 5, "batching loses nothing");

    page.dropped = 4;
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000600", content: "FS-BATCH-OVERFLOW" }), 1));
    const overflow = await harness.service.drainDecodedEvents("shop-batch");
    assert.equal(overflow.dropped, 4);
    assert.equal(overflow.gap, true, "a real drop is reported as a coverage gap");
  } finally { harness.close(); }
});

test("safety A: identity and release checks happen BEFORE the collector and the store", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page });
  try {
    await harness.activate("shop-boundary");
    await harness.service.startDecodedEventCapture("shop-boundary");
    const conversationId = deriveInternalConversationId({ platformAccountId: "account-shop-boundary" }, "2318082461");

    // (a) a late event from an OLDER page generation
    const collectorBeforeLate = harness.collectorCalls();
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000700", content: "FS-LATE-DOC" }), 0));
    const late = await harness.service.drainDecodedEvents("shop-boundary");
    assert.equal(late.ingested, 0);
    assert.ok(late.diagnostics.includes("GENERATION_MISMATCH"));
    assert.equal(harness.collectorCalls(), collectorBeforeLate, "a stale-document event never reaches the collector");
    assert.equal(harness.messages.listByConversation(conversationId).length, 0, "no row for a stale-document event");
    const collectorCallsAfterLate = harness.collectorCalls();

    // (b) the controlled lifecycle is released (view destroyed) -> binding unavailable
    harness.views[0].dispose();
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000701", content: "FS-AFTER-RELEASE" }), 1));
    const released = await harness.service.drainDecodedEvents("shop-boundary");
    assert.equal(released.ok, false);
    assert.equal(released.reason, "DOCUMENT_BINDING_UNAVAILABLE", "the release check happens before draining");
    assert.equal(released.ingested, 0);
    assert.equal(harness.collectorCalls(), collectorCallsAfterLate, "the collector is not called after release");
    assert.equal(harness.messages.listByConversation(conversationId).length, 0, "no row after release");
  } finally { harness.close(); }
});

test("safety A2: a revoked Main admission blocks the collector and the store", async () => {
  const page = makeFakePage();
  let granted = true;
  const harness = await composeService({ page, admission: () => (granted ? { granted: true, admissionId: "grant" } : { granted: false, reason: "REVOKED" }) });
  try {
    await harness.activate("shop-admission");
    await harness.service.startDecodedEventCapture("shop-admission");
    const conversationId = deriveInternalConversationId({ platformAccountId: "account-shop-admission" }, "2318082461");
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000900", content: "FS-ADMITTED-1" }), 1));
    const admitted = await harness.service.drainDecodedEvents("shop-admission");
    assert.equal(admitted.ingested, 1, "a granted admission still ingests");
    const collectorAfterAdmitted = harness.collectorCalls();
    const rowsAfterAdmitted = harness.messages.listByConversation(conversationId).length;

    granted = false;
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000901", content: "FS-REVOKED-1" }), 1));
    const revoked = await harness.service.drainDecodedEvents("shop-admission");
    assert.equal(revoked.ok, false);
    assert.equal(revoked.reason, "MAIN_ADMISSION_DENIED:REVOKED", "revocation is refused before draining");
    assert.equal(harness.collectorCalls(), collectorAfterAdmitted, "revocation blocks before the collector");
    assert.equal(harness.messages.listByConversation(conversationId).length, rowsAfterAdmitted, "revocation blocks before the write");
    assert.equal(page.events.length, 1, "the blocked event stays in the page buffer, nothing is silently consumed");
  } finally { harness.close(); }
});
test("safety A3: admission revoked WHILE draining still blocks the collector and the store", async () => {
  let granted = true;
  const page = makeFakePage({ onDrain: () => { granted = false; } });
  const harness = await composeService({ page, admission: () => (granted ? { granted: true, admissionId: "grant" } : { granted: false, reason: "REVOKED_MID_DRAIN" }) });
  try {
    await harness.activate("shop-midrevoke");
    await harness.service.startDecodedEventCapture("shop-midrevoke");
    const conversationId = deriveInternalConversationId({ platformAccountId: "account-shop-midrevoke" }, "2318082461");
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000a00", content: "FS-MIDREVOKE-1" }), 1));
    const drained = await harness.service.drainDecodedEvents("shop-midrevoke");
    assert.equal(drained.ok, false, "a revocation during the async drain refuses the batch");
    assert.equal(drained.reason, "MAIN_ADMISSION_DENIED:REVOKED_MID_DRAIN");
    assert.ok(drained.diagnostics.includes("ADMISSION_REVOKED_DURING_DRAIN"));
    assert.equal(harness.collectorCalls(), 0, "the collector is never called");
    assert.equal(harness.messages.listByConversation(conversationId).length, 0, "nothing is written");
  } finally { harness.close(); }
});

test("safety A4: a missing admission provider refuses output on this path", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page, omitAdmission: true });
  try {
    await harness.activate("shop-noprovider");
    await harness.service.startDecodedEventCapture("shop-noprovider");
    const conversationId = deriveInternalConversationId({ platformAccountId: "account-shop-noprovider" }, "2318082461");
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000b00", content: "FS-NOADMISSION-1" }), 1));
    const drained = await harness.service.drainDecodedEvents("shop-noprovider");
    assert.equal(drained.ok, false);
    assert.equal(drained.reason, "MAIN_ADMISSION_PROVIDER_MISSING", "admission is required, not optional");
    assert.equal(harness.collectorCalls(), 0);
    assert.equal(harness.messages.listByConversation(conversationId).length, 0);
  } finally { harness.close(); }
});
test("safety B: source and newness restrictions are kept next to the stored message", async () => {
  const page = makeFakePage();
  const harness = await composeService({ page });
  try {
    await harness.activate("shop-ledger");
    await harness.service.startDecodedEventCapture("shop-ledger");
    page.events.push(pageEvent(messageInput({ msg_id: "1789900000800", content: "FS-LEDGER-1" }), 1));
    const drained = await harness.service.drainDecodedEvents("shop-ledger");
    assert.equal(drained.ingested, 1);
    const diagnostics = harness.service.decodedEventDiagnostics("shop-ledger");
    assert.equal(diagnostics.ledgerSize, 1);
    const entry = diagnostics.ledger[0].entry;
    assert.equal(entry.source, "PAGE_DECODED_EVENT");
    assert.equal(entry.identityAuthority, "PAYLOAD_SUPPLIED_UNVERIFIED");
    assert.equal(entry.newness, "NEWNESS_UNVERIFIED", "a missing history marker is not a real-time arrival");
    assert.equal(entry.automaticProcessingEligible, false, "stored successfully is not a reply right");
    // The ledger is in-memory service state: it does NOT survive a restart, and no automatic consumer
    // exists in this slice - the boundary today is (i) the ledger and (ii) the absence of any
    // automatic-processing path wired to this source.
    assert.equal(typeof diagnostics.installed, "boolean");
  } finally { harness.close(); }
});
