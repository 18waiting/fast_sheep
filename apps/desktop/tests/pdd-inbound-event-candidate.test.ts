// Local validation for the decoded-inbound-event candidate gate and its Main-side path.
// Covers: three consecutive messages, duplicate notification, two customers, two shops with the same
// customer/message id, document/identity mismatch, history/local/recall/merchant isolation, and the
// explicit-failure rule (no legacy fallback).
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveInternalConversationId } from "@fastwork/platform-pdd";
import { toInboundEventCandidate } from "../dist/main/platforms/pdd/pdd-inbound-event-candidate.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";
import { createCanonicalInboundPersistence } from "../dist/main/services/canonical-inbound-persistence.js";

const resolution = (value) => (value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value });

function pageEvent(overrides = {}) {
  return {
    from: { role: "user", uid: "2318082461" },
    to: { role: "mall_cs", uid: "1000000000003" },
    content: "FS-EVT-1",
    type: 0,
    msg_id: "1789900000001",
    ...overrides,
  };
}

/** Mirrors the collector wiring: one shop + one document binding. */
function makeScope(shop) {
  const scope = () => ({
    merchantId: resolution(shop.merchant),
    storeId: resolution(shop.store),
    platformAccountId: resolution(shop.account),
  });
  return scope;
}

function mapCandidate(event, shop) {
  const candidate = toInboundEventCandidate(event);
  if (candidate.status !== "CANDIDATE") return candidate;
  const scope = makeScope(shop);
  const document = { sessionId: "pdd-session-" + shop.shopId, shopId: shop.shopId, documentGeneration: shop.generation ?? 1 };
  return processPddInboundIngress({
    document,
    input: candidate.ingressInput,
    resolveScope: scope,
    resolveIdentity: (message, doc) => {
      const conversationId = deriveInternalConversationId({ platformAccountId: shop.account }, message.customerUid);
      if (conversationId === null) return null;
      return {
        runtimeShop: resolution({ value: doc.shopId }),
        scope: scope(),
        runtimeConversationReference: resolution(undefined),
        association: {
          ownerRuntimeShopId: doc.shopId,
          ownerScope: scope(),
          platformCustomerId: message.customerUid,
          platformMessageId: message.platformMessageId,
          internalConversationId: resolution(conversationId),
          localMessageId: resolution("local-" + message.platformMessageId),
        },
      };
    },
    canonicalValidator: undefined,
  });
}

const SHOP_A = { merchant: "merchant-event", store: "store-event-a", account: "account-event-a", shopId: "shop-event-a" };
const SHOP_B = { merchant: "merchant-event", store: "store-event-b", account: "account-event-b", shopId: "shop-event-b" };

function memoryStore() {
  const conversations = new Map();
  const messages = new Map();
  const repos = {
    conversations: { findById: (id) => conversations.get(id) ?? null, save: (record) => conversations.set(record.id, record) },
    messages: { findById: (id) => messages.get(id) ?? null, save: (record) => messages.set(record.id, record) },
  };
  return { repos, conversations, messages, persistence: createCanonicalInboundPersistence(repos) };
}

test("three consecutive messages are captured individually and unmodified", () => {
  const events = ["FS-EVT-ALPHA", "FS-EVT-BETA", "FS-EVT-GAMMA"].map((content, index) => pageEvent({ content, msg_id: "178990000010" + index }));
  const candidates = events.map((event) => toInboundEventCandidate(event));
  assert.deepEqual(candidates.map((entry) => entry.status), ["CANDIDATE", "CANDIDATE", "CANDIDATE"]);
  assert.deepEqual(candidates.map((entry) => entry.ingressInput.payload.content), ["FS-EVT-ALPHA", "FS-EVT-BETA", "FS-EVT-GAMMA"]);
  assert.deepEqual(candidates.map((entry) => entry.ingressInput.payload.msg_id), ["1789900000100", "1789900000101", "1789900000102"]);
  assert.ok(candidates.every((entry) => entry.ingressInput.sourceOccurredAt === null), "source time stays null while its semantics are unverified");
  assert.ok(candidates.every((entry) => entry.idProvenance === "PAYLOAD_SUPPLIED_UNVERIFIED"));
  for (const candidate of candidates) assert.equal(mapCandidateOf(candidate).status, "MAPPED");
});

function mapCandidateOf(candidate) {
  const scope = makeScope(SHOP_A);
  return processPddInboundIngress({
    document: { sessionId: "pdd-session-shop-event-a", shopId: SHOP_A.shopId, documentGeneration: 1 },
    input: candidate.ingressInput,
    resolveScope: scope,
    resolveIdentity: (message, doc) => ({
      runtimeShop: resolution({ value: doc.shopId }),
      scope: scope(),
      runtimeConversationReference: resolution(undefined),
      association: { ownerRuntimeShopId: doc.shopId, ownerScope: scope(), platformCustomerId: message.customerUid, platformMessageId: message.platformMessageId, internalConversationId: resolution(deriveInternalConversationId({ platformAccountId: SHOP_A.account }, message.customerUid)), localMessageId: resolution("local-" + message.platformMessageId) },
    }),
    canonicalValidator: undefined,
  });
}

test("a duplicated notification of the same message is deduplicated by the Main store", () => {
  const store = memoryStore();
  const event = pageEvent({ content: "FS-EVT-DUP", msg_id: "1789900000200" });
  const first = mapCandidate(event, SHOP_A);
  const second = mapCandidate(event, SHOP_A);
  assert.equal(first.status, "MAPPED");
  assert.equal(second.status, "MAPPED");
  assert.equal(store.persistence.ingest(first.envelope).status, "INGESTED");
  assert.equal(store.persistence.ingest(second.envelope).status, "DUPLICATE");
  assert.equal(store.messages.size, 1);
});

test("two customers never share a conversation", () => {
  const store = memoryStore();
  for (const [uid, msgId] of [["2318082461", "1789900000301"], ["2318082462", "1789900000302"]]) {
    const mapped = mapCandidate(pageEvent({ from: { role: "user", uid }, msg_id: msgId }), SHOP_A);
    assert.equal(mapped.status, "MAPPED");
    assert.equal(store.persistence.ingest(mapped.envelope).status, "INGESTED");
  }
  assert.equal(store.conversations.size, 2);
});

test("two controlled shops with the same customer and the same message id stay isolated", () => {
  const store = memoryStore();
  const event = pageEvent({ content: "FS-EVT-SHARED", msg_id: "1789900000400" });
  for (const shop of [SHOP_A, SHOP_B]) {
    const mapped = mapCandidate(event, shop);
    assert.equal(mapped.status, "MAPPED");
    assert.equal(store.persistence.ingest(mapped.envelope).status, "INGESTED", "the same ids in another shop are not deduplicated away");
  }
  assert.equal(store.conversations.size, 2);
  assert.equal(store.messages.size, 2);
});

test("an event whose runtime identity does not match the Main document is rejected", () => {
  const candidate = toInboundEventCandidate(pageEvent({ msg_id: "1789900000500" }));
  assert.equal(candidate.status, "CANDIDATE");
  const scope = makeScope(SHOP_A);
  const mismatched = processPddInboundIngress({
    document: { sessionId: "pdd-session-shop-event-a", shopId: SHOP_A.shopId, documentGeneration: 2 },
    input: candidate.ingressInput,
    resolveScope: scope,
    resolveIdentity: (message) => ({
      runtimeShop: resolution({ value: SHOP_B.shopId }),
      scope: scope(),
      runtimeConversationReference: resolution(undefined),
      association: { ownerRuntimeShopId: SHOP_B.shopId, ownerScope: scope(), platformCustomerId: message.customerUid, platformMessageId: message.platformMessageId, internalConversationId: resolution(deriveInternalConversationId({ platformAccountId: SHOP_A.account }, message.customerUid)), localMessageId: resolution("local-" + message.platformMessageId) },
    }),
    canonicalValidator: undefined,
  });
  assert.equal(mismatched.status, "REJECTED");
  assert.equal(mismatched.reason, "RUNTIME_SHOP_MISMATCH", "a stale/foreign source cannot borrow the current document identity");
});

test("history, recall, non-text, unknown type, merchant messages and client-only ids are rejected explicitly", () => {
  const cases = [
    [pageEvent({ is_history: true }), "HISTORY_LOAD"],
    [pageEvent({ type: 31 }), "RECALL_NOTICE"],
    [pageEvent({ type: 26 }), "NON_TEXT_MESSAGE"],
    [pageEvent({ type: 7 }), "UNKNOWN_TYPE"],
    [pageEvent({ type: undefined }), "UNKNOWN_TYPE"],
    [pageEvent({ from: { role: "mall_cs", uid: "1" }, to: { role: "user", uid: "2" } }), "NOT_CUSTOMER_DIRECTION"],
    [pageEvent({ content: "" }), "CONTENT_MISSING"],
    [pageEvent({ msg_id: undefined, client_msg_id: "client-1" }), "PLATFORM_MESSAGE_ID_MISSING"],
    ["not-an-object", "EVENT_NOT_OBJECT"],
  ];
  for (const [event, reason] of cases) {
    const result = toInboundEventCandidate(event);
    assert.equal(result.status, "REJECTED", "event must be rejected: " + JSON.stringify(event));
    assert.equal(result.reason, reason);
  }
  const clientOnly = toInboundEventCandidate(pageEvent({ msg_id: undefined, client_msg_id: "client-1" }));
  assert.ok(clientOnly.diagnostics.includes("CLIENT_MSG_ID_PRESENT_WITHOUT_PLATFORM_ID"));
});

test("a rejected event produces no ingress input and no fallback path", () => {
  for (const event of [pageEvent({ is_history: true }), pageEvent({ type: 31 }), pageEvent({ from: { role: "mall_cs" } })]) {
    const result = toInboundEventCandidate(event);
    assert.equal(result.status, "REJECTED");
    assert.equal(result.ingressInput, undefined, "no candidate input is produced for a rejection");
  }
});