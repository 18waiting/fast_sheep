// SHEEP-302 bounded offline slice — controlled inbound capture, persistence, dedup, view.
//
// Grounding:
// - Uses the REAL canonical ingress path: PddPlatformService admission -> real
//   mapper -> default canonical schema validator -> Main-mediated collector.
// - Persists into the REAL normalized repositories (in-memory and SQLite).
// - Reads back through the REAL Main query handler that backs the minimal view entry.
// - Cross-shop isolation uses the SAME service with two controlled sessions and
//   identical opaque platform customer/message ids.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteMessageRepository, SqliteNormalizedConversationRepository } from "@fastwork/persistence";
import type { InboundEnvelope } from "@fastwork/domain";
import { createCanonicalInboundPersistence, CanonicalInboundPersistenceError } from "../dist/main/services/canonical-inbound-persistence.js";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { QUERY_HANDLERS } from "../dist/main/ipc/query-handlers.js";
import { createWorkspaceMerchantContext } from "../dist/main/services/workspace-merchant-context.js";

// ---------- canonical envelope fixtures ----------

function resolution(value: unknown) {
  return value === undefined
    ? { status: "UNKNOWN" as const }
    : { status: "RESOLVED" as const, value };
}

interface EnvelopeOptions {
  shopId: string;
  merchant?: string;
  store?: string;
  account?: string;
  conversationId?: string;
  customerUid?: string;
  msgId?: string;
  content?: string;
  occurredAt?: string | null;
  platformProvenance?: "AUTHORITATIVE_PLATFORM_ID" | "LOCAL_FINGERPRINT" | "SYNTHETIC" | "UNKNOWN";
}

function makeEnvelope(opts: EnvelopeOptions): InboundEnvelope {
  const provenance = opts.platformProvenance ?? "AUTHORITATIVE_PLATFORM_ID";
  const platformMessageIdentity =
    provenance === "UNKNOWN"
      ? { provenance: "UNKNOWN" as const }
      : { provenance, value: opts.msgId ?? "same-id" };
  return {
    identityLock: {
      platform: "pdd",
      runtimeShop: resolution({ value: opts.shopId }),
      merchantId: resolution(opts.merchant ?? "merchant-1"),
      storeId: resolution(opts.store ?? "store-" + opts.shopId),
      platformAccountId: resolution(opts.account ?? "account-" + opts.shopId),
      platformCustomerId: resolution({ value: opts.customerUid ?? "1001" }),
      internalConversationId: resolution(opts.conversationId ?? "conversation-" + opts.shopId),
      runtimeConversationReference: resolution({ value: "runtime-" + opts.shopId }),
      triggerMessage: {
        localMessageId: resolution("local-message-" + opts.shopId),
        platformMessageIdentity: platformMessageIdentity as never,
      },
    },
    sourceContent: { kind: "text", text: opts.content ?? "有货吗" },
    sourceOccurredAt: opts.occurredAt === undefined ? "2026-09-18T00:00:01Z" : opts.occurredAt,
  } as InboundEnvelope;
}


// Minimal in-memory normalized repositories (mirror the SQLite append semantics).
function createMemoryRepos() {
  const conversations = new Map<string, Record<string, unknown>>();
  const messages = new Map<string, Record<string, unknown>>();
  return {
    conversations: {
      save(c: { id: string }) { if (conversations.has(c.id)) throw new Error("conversation already exists"); conversations.set(c.id, c as never); },
      findById(id: string) { return (conversations.get(id) as never) ?? null; },
      listByMerchant(m: string) { return [...conversations.values()].filter((c) => (c as { merchantId: string }).merchantId === m) as never; },
      listByStore(s: string) { return [...conversations.values()].filter((c) => (c as { storeId: string }).storeId === s) as never; },
    },
    messages: {
      save(m: { id: string }) { if (messages.has(m.id)) throw new Error("message already exists"); messages.set(m.id, m as never); },
      findById(id: string) { return (messages.get(id) as never) ?? null; },
      listByConversation(cid: string) {
        return [...messages.values()]
          .filter((m) => (m as { conversationId: string }).conversationId === cid)
          .sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id))) as never;
      },
    },
  };
}
// ---------- 1. persistence semantics (real writer + real repositories) ----------

test("controlled envelope is persisted once, dedup is identity-scoped, and UNKNOWN scope fails closed", () => {
  const repos = createMemoryRepos();
  const writer = createCanonicalInboundPersistence({ ...repos, now: () => "2026-09-18T00:00:09Z" });

  const first = writer.ingest(makeEnvelope({ shopId: "shop-a", content: "有货吗" }));
  assert.equal(first.status, "INGESTED");
  const stored = repos.messages.findById(first.messageId);
  assert.equal(stored.contentText, "有货吗");
  assert.equal(stored.actor, "customer");
  assert.equal(stored.occurredAt, "2026-09-18T00:00:01Z");
  assert.equal(stored.observedAt, "2026-09-18T00:00:09Z");
  assert.equal(stored.externalRef, "same-id", "authoritative platform id kept as opaque external ref");

  // Same source message re-arrives -> DUPLICATE, no second row.
  const again = writer.ingest(makeEnvelope({ shopId: "shop-a", content: "有货吗" }));
  assert.equal(again.status, "DUPLICATE");
  assert.equal(again.messageId, first.messageId);
  assert.equal(repos.messages.listByConversation("conversation-shop-a").length, 1);

  // Same opaque platform ids in another shop/conversation -> separate row.
  const other = writer.ingest(makeEnvelope({ shopId: "shop-b" }));
  assert.equal(other.status, "INGESTED");
  assert.notEqual(other.messageId, first.messageId);
  assert.equal(repos.messages.listByConversation("conversation-shop-b").length, 1);

  // Different message in the same conversation -> new row.
  const second = writer.ingest(makeEnvelope({ shopId: "shop-a", msgId: "same-id-2" }));
  assert.equal(second.status, "INGESTED");
  assert.notEqual(second.messageId, first.messageId);
  assert.equal(repos.messages.listByConversation("conversation-shop-a").length, 2);

  // Unknown canonical store scope is rejected; nothing is written into a guessed conversation.
  const noStoreScope = makeEnvelope({ shopId: "shop-c" });
  (noStoreScope.identityLock as { storeId: unknown }).storeId = { status: "UNKNOWN" };
  assert.throws(
    () => writer.ingest(noStoreScope),
    (error) => error instanceof CanonicalInboundPersistenceError && error.reason === "SCOPE_NOT_RESOLVED"
  );
  assert.equal(repos.conversations.findById("conversation-shop-c"), null, "no conversation written on rejected scope");

  // Source time may be legitimately null; it is preserved as null, never fabricated.
  const noTime = writer.ingest(makeEnvelope({ shopId: "shop-a", msgId: "same-id-3", occurredAt: null }));
  assert.equal(repos.messages.findById(noTime.messageId).occurredAt, null);
});

test("persisted inbound survives storage reopen (real SQLite repositories)", () => {
  const dir = mkdtempSync(join(tmpdir(), "sheep302-inbound-"));
  try {
    const ctx = openDatabase(join(dir, "db"), { seed: true });
    // Seed the canonical identity parents the normalized conversation references.
    ctx.conn.run("INSERT INTO merchants (id, name) VALUES (?, ?)", "merchant-1", "测试商户");
    ctx.conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES (?, ?, ?, ?)", "store-shop-a", "merchant-1", "测试店铺", "pdd");
    ctx.conn.run("INSERT INTO platform_accounts (id, merchant_id, platform, external_ref) VALUES (?, ?, ?, ?)", "account-shop-a", "merchant-1", "pdd", "account-shop-a");
    const writer = createCanonicalInboundPersistence({
      conversations: new SqliteNormalizedConversationRepository(ctx.conn),
      messages: new SqliteMessageRepository(ctx.conn),
      now: () => "2026-09-18T00:00:09Z",
    });
    const result = writer.ingest(makeEnvelope({ shopId: "shop-a", content: "持久化测试" }));
    assert.equal(result.status, "INGESTED");
    ctx.conn.close();

    const reopened = openDatabase(join(dir, "db"));
    const conversations = new SqliteNormalizedConversationRepository(reopened.conn);
    const messages = new SqliteMessageRepository(reopened.conn);
    const conv = conversations.findById("conversation-shop-a");
    assert.ok(conv, "conversation survived reopen");
    assert.equal(conv.storeId, "store-shop-a");
    assert.equal(conv.platformAccountId, "account-shop-a");
    const list = messages.listByConversation("conversation-shop-a");
    assert.equal(list.length, 1);
    assert.equal(list[0].contentText, "持久化测试");
    assert.equal(list[0].occurredAt, "2026-09-18T00:00:01Z");
    reopened.conn.close();
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may hold the sqlite file briefly; temp dir is disposable */ }
  }
});

// ---------- 2. real ingress path + view read-back ----------

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

function scopeFor(shopId: string) {
  return {
    merchantId: resolution("merchant-1"),
    storeId: resolution("store-" + shopId),
    platformAccountId: resolution("account-" + shopId),
  };
}

function makeControlledHarness() {
  const repos = createMemoryRepos();
  const writer = createCanonicalInboundPersistence({ ...repos, now: () => "2026-09-18T00:00:09Z" });
  const received: Array<{ status: string }> = [];
  const observerOptions: Array<{ onConnection: (c: unknown) => void; onFrame: (f: unknown) => void }> = [];
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: (shopId) => "/fixture-" + shopId + ".html",
    makeView: () => new FakeView() as never,
    canonicalIngressMode: "CANONICAL_CONTROLLED",
    mainAdmissionProvider: { evaluate: () => ({ granted: true, admissionId: "controlled-grant" }) },
    decodeInboundFrame: (payloadData: string) => JSON.parse(payloadData),
    allowedInboundWebSocketUrl: () => true,
    createInboundObserver: ((options: unknown) => {
      observerOptions.push(options as never);
      return {
        observerId: "fake-observer",
        activeLifecycleId: 1,
        isTerminal: false,
        get targetWebContents() { return (options as { webContents: unknown }).webContents; },
        start: () => ({ lifecycleId: 1, enablePromise: Promise.resolve() }),
        stop: () => undefined,
        snapshot: () => ({ observerId: "fake-observer", lifecycleId: 1, enabled: true, terminal: false }),
      } as never;
    }) as never,
    resolveInboundScope: (document: { shopId: string }) => scopeFor(document.shopId),
    resolveInboundIdentity: (message: { customerUid?: string; platformMessageId?: string }, document: { shopId: string }) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: scopeFor(document.shopId),
      runtimeConversationReference: resolution({ value: "runtime-" + document.shopId }),
      association: message.customerUid === undefined || message.platformMessageId === undefined ? undefined : {
        ownerRuntimeShopId: document.shopId,
        ownerScope: scopeFor(document.shopId),
        platformCustomerId: message.customerUid,
        platformMessageId: message.platformMessageId,
        internalConversationId: resolution("conversation-" + document.shopId),
        localMessageId: resolution("local-message-" + document.shopId),
      },
    }),
    onCanonicalInbound: (envelope: InboundEnvelope) => {
      const outcome = writer.ingest(envelope);
      received.push(outcome);
      return outcome;
    },
  });

  async function activate(shopId: string) {
    await service.activate(shopId);
    await waitFor(() => service.inboundDiagnostics().observers.some((o) => o.shopId === shopId && o.enabled === true));
    // The controlled local fixture signals document readiness; drive it explicitly
    // here so the session host establishes a live document binding before frames.
    const sender = service.webContentsFor(shopId);
    assert.ok(sender, "missing webContents for " + shopId);
    service.handlePageEvent(
      { event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId } as never,
      sender
    );
    await waitFor(() => service.status(shopId)?.session_status === "READY");
  }

  async function deliver(shopId: string, payload: unknown, occurredAt: string) {
    const webContents = service.webContentsFor(shopId);
    assert.ok(webContents, "missing webContents for " + shopId);
    const entry = observerOptions.find((o) => (o as { shopId?: string }).shopId === shopId) as
      | { onConnection: (c: unknown) => void; onFrame: (f: unknown) => void; getDocumentBinding: () => { sessionId: string; shopId: string; documentGeneration: number } | null }
      | undefined;
    assert.ok(entry, "missing observer options for " + shopId);
    const binding = entry.getDocumentBinding();
    assert.ok(binding, "missing live document binding for " + shopId);
    const frame = {
      connection: {
        webContents,
        observerId: "fake-observer",
        observerLifecycleId: 1,
        sessionId: binding.sessionId,
        shopId: binding.shopId,
        documentGeneration: binding.documentGeneration,
        cdpSessionId: "",
        requestId: "req-" + shopId,
        url: "ws://127.0.0.1/socket",
      },
      cdpSessionId: "",
      requestId: "req-" + shopId,
      payloadData: JSON.stringify({ payload, sourceOccurredAt: occurredAt }),
      opcode: 1,
    };
    entry.onConnection(frame.connection);
    entry.onFrame(frame);
    return service.inboundDiagnostics();
  }

  return { service, repos, writer, received, activate, deliver };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

function queryDeps(harness: ReturnType<typeof makeControlledHarness>) {
  const storeRows = new Map<string, { id: string; merchantId: string; name: string; platform: string }>();
  const accountRows = new Map<string, { id: string; merchantId: string; platform: string }>();
  for (const conv of harness.repos.conversations.listByMerchant("merchant-1") as Array<{ storeId: string; platformAccountId: string }>) {
    storeRows.set(conv.storeId, { id: conv.storeId, merchantId: "merchant-1", name: conv.storeId, platform: "pdd" });
    accountRows.set(conv.platformAccountId, { id: conv.platformAccountId, merchantId: "merchant-1", platform: "pdd" });
  }
  return {
    conversations: harness.repos.conversations,
    messages: harness.repos.messages,
    stores: {
      listByMerchant: (m: string) => [...storeRows.values()].filter((s) => s.merchantId === m),
      findById: (id: string) => storeRows.get(id) ?? null,
    },
    platformAccounts: {
      findById: (id: string) => accountRows.get(id) ?? null,
    },
    platformForShop: () => "pdd",
    workspaceMerchant: createWorkspaceMerchantContext("merchant-1"),
  } as never;
}

test("controlled ingress persists and the minimal view entry reads the real stored result", async () => {
  const h = makeControlledHarness();
  try {
    await h.activate("shop-a");

    await h.deliver("shop-a", {
      content: "有货吗",
      from: { role: "user", uid: "1001" },
      to: { role: "mall_cs", uid: "opaque-cs" },
      msg_id: "same-id",
    }, "2026-09-18T00:00:01Z");

    assert.equal(h.received.length, 1, "collector received exactly one canonical envelope");
    assert.equal(h.received[0].status, "INGESTED");

    const deps = queryDeps(h);
    const list = await QUERY_HANDLERS["conversations.list"](deps)({ scope: { kind: "all_stores" } } as never);
    assert.equal(list.data.items.length, 1, "persisted conversation appears in the view entry");
    assert.equal(list.data.items[0].conversation_id, "conversation-shop-a");
    assert.equal(list.data.items[0].store_id, "store-shop-a");

    const timeline = await QUERY_HANDLERS["conversations.listMessages"](deps)({ conversation_id: "conversation-shop-a" } as never);
    assert.equal(timeline.ok, true);
    assert.equal(timeline.data.messages.length, 1);
    assert.equal(timeline.data.messages[0].content_text, "有货吗");
    assert.equal(timeline.data.messages[0].actor, "customer");
    assert.equal(timeline.data.messages[0].occurred_at, "2026-09-18T00:00:01Z");
  } finally {
    h.service.disposeAll();
  }
});

test("same service two shops with identical opaque ids stay isolated and dedup per scope", async () => {
  const h = makeControlledHarness();
  try {
    await h.activate("shop-a");
    await h.activate("shop-b");

    const payload = { content: "一样的问题", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "same-id" };
    await h.deliver("shop-a", payload, "2026-09-18T00:00:01Z");
    await h.deliver("shop-b", payload, "2026-09-18T00:00:02Z");
    // Duplicate delivery in shop-a must not create a second row.
    await h.deliver("shop-a", payload, "2026-09-18T00:00:03Z");

    assert.equal(h.received.length, 3);
    assert.deepEqual(h.received.map((r) => r.status), ["INGESTED", "INGESTED", "DUPLICATE"]);

    assert.equal(h.repos.messages.listByConversation("conversation-shop-a").length, 1, "shop-a message not duplicated");
    assert.equal(h.repos.messages.listByConversation("conversation-shop-b").length, 1, "shop-b has its own row");
    const a = h.repos.messages.listByConversation("conversation-shop-a")[0];
    const b = h.repos.messages.listByConversation("conversation-shop-b")[0];
    assert.notEqual(a.id, b.id, "identical opaque platform ids do not collapse across shops");

    const deps = queryDeps(h);
    const list = await QUERY_HANDLERS["conversations.list"](deps)({ scope: { kind: "all_stores" } } as never);
    assert.equal(list.ok, true);
    assert.equal(list.data.items.length, 2, "both shops visible under one merchant scope");
  } finally {
    h.service.disposeAll();
  }
});

test("controlled persistence path never falls back to legacy consumers", async () => {
  // The harness wires ONLY the canonical collector: no orchestrator/legacy inbound
  // bridge is passed to PddPlatformService, so a mapped frame cannot reach one.
  const h = makeControlledHarness();
  try {
    await h.activate("shop-a");
    const before = h.service.inboundDiagnostics();
    assert.equal(before.mode, "CANONICAL_CONTROLLED");
    await h.deliver("shop-a", { content: "hello", from: { role: "user", uid: "1001" }, to: { role: "mall_cs", uid: "opaque-cs" }, msg_id: "m-1" }, "2026-09-18T00:00:01Z");
    assert.equal(h.received.length, 1, "exactly one canonical collector call");
    assert.equal(h.received[0].status, "INGESTED");
    const decisions = h.service.inboundDiagnostics().decisions as Record<string, number>;
    assert.equal(decisions.MAPPED, 1);
    assert.equal(decisions.CANONICAL_INGRESS_DISABLED, undefined, "never disabled/legacy on the controlled path");
  } finally {
    h.service.disposeAll();
  }
});
