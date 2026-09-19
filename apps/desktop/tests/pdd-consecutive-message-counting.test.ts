// Consecutive-message counting + dedup regression (in-memory only, synthetic).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePddLatestConversationsPayload, decodePddOrderCsGroupConvListPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";
import { createCanonicalInboundPersistence } from "../dist/main/services/canonical-inbound-persistence.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));
const res = (v) => (v === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value: v });
const scope = () => ({ merchantId: res("m"), storeId: res("store-x"), platformAccountId: res("acct-x") });
const doc = { sessionId: "pdd-session-shop-x", shopId: "shop-x", documentGeneration: 1 };

function memoryRepos() {
  const conversations = new Map(); const messages = new Map();
  return {
    conversations: { save(c) { if (conversations.has(c.id)) throw new Error("exists"); conversations.set(c.id, c); }, findById: (id) => conversations.get(id) ?? null, listByMerchant: () => [...conversations.values()], listByStore: () => [...conversations.values()] },
    messages: { save(m) { if (messages.has(m.id)) throw new Error("exists"); messages.set(m.id, m); }, findById: (id) => messages.get(id) ?? null, listByConversation: (cid) => [...messages.values()].filter((m) => m.conversationId === cid) },
  };
}
function identityFor(message, document) {
  return {
    runtimeShop: res({ value: document.shopId }), scope: scope(),
    runtimeConversationReference: res({ value: "rt" }),
    association: { ownerRuntimeShopId: document.shopId, ownerScope: scope(), platformCustomerId: message.customerUid, platformMessageId: message.platformMessageId, internalConversationId: res("conv-x"), localMessageId: res("local-" + message.platformMessageId) },
  };
}
function toEnvelope(input) {
  const r = processPddInboundIngress({ document: doc, input, resolveScope: () => scope(), resolveIdentity: identityFor, canonicalValidator: undefined });
  assert.equal(r.status, "MAPPED", JSON.stringify(r));
  return r.envelope;
}
function latestResponse(records) {
  return JSON.stringify({ success: true, result: { conversations: records } });
}
function convListResponse(records) {
  return JSON.stringify({ success: true, result: { total: records.length, data: records.map((r) => ({ lastMessage: r, userInfo: { uid: r.from.uid, nickname: "n" } })) } });
}
function rec(uid, msgId, content, ts) {
  return { from: { role: "user", uid }, to: { role: "mall_cs", uid: "900000001" }, content, msg_id: msgId, ts, client_msg_id: "c-" + msgId, type: 0, version: 1, status: "unread" };
}

test("three distinct messages across two endpoints and duplicate responses count and dedupe correctly", () => {
  const repos = memoryRepos();
  const writer = createCanonicalInboundPersistence({ ...repos, now: () => "2026-01-01T00:00:00Z" });
  const arrivals = new Map(); // msgId -> times seen
  const unique = new Set();
  const outcomes = [];

  const feed = (decoded) => {
    for (const m of decoded.messages) {
      if (!m.ingressInput) continue;
      const envelope = toEnvelope(m.ingressInput);
      const id = envelope.identityLock.triggerMessage.platformMessageIdentity.value;
      unique.add(id);
      arrivals.set(id, (arrivals.get(id) ?? 0) + 1);
      outcomes.push({ id, status: writer.ingest(envelope).status });
    }
  };

  // response 1: messages A + C (newest first) via latest_conversations
  feed(decodePddLatestConversationsPayload(latestResponse([rec("800000001", "M3", "第三条", "1700003000"), rec("800000001", "M1", "第一条", "1700001000")])));
  // response 2: same A + B via the second observed endpoint (overlap => duplicates)
  feed(decodePddOrderCsGroupConvListPayload(convListResponse([rec("800000001", "M1", "第一条", "1700001000"), rec("800000001", "M2", "第二条", "1700002000")])));
  // response 3: replay of all three via latest_conversations
  feed(decodePddLatestConversationsPayload(latestResponse([rec("800000001", "M2", "第二条", "1700002000"), rec("800000001", "M3", "第三条", "1700003000"), rec("800000001", "M1", "第一条", "1700001000")])));

  assert.equal(unique.size, 3, "three distinct expected messages observed");
  assert.deepEqual([...arrivals.keys()].sort(), ["M1", "M2", "M3"]);
  assert.equal(arrivals.get("M1"), 3, "M1 seen three times");
  assert.equal(arrivals.get("M2"), 2, "M2 seen twice");
  assert.equal(arrivals.get("M3"), 2, "M3 seen twice");
  const ingested = outcomes.filter((o) => o.status === "INGESTED");
  const duplicates = outcomes.filter((o) => o.status === "DUPLICATE");
  assert.equal(ingested.length, 3, "each distinct message processed exactly once");
  assert.equal(duplicates.length, 4, "every repeat response is a duplicate, not a new task");
  assert.equal(repos.messages.listByConversation("conv-x").length, 3, "exactly one stored row per distinct message");
});

test("a missing message is reported as missing, not inferred from ids or times", () => {
  const repos = memoryRepos();
  const writer = createCanonicalInboundPersistence({ ...repos, now: () => "2026-01-01T00:00:00Z" });
  const expected = ["M1", "M2", "M3"];
  const observed = new Set();
  // Only M2 and M3 arrive; M1 never does.
  const decoded = decodePddLatestConversationsPayload(latestResponse([rec("800000001", "M3", "第三条", "1700003000"), rec("800000001", "M2", "第二条", "1700002000")]));
  for (const m of decoded.messages) {
    if (!m.ingressInput) continue;
    const env = toEnvelope(m.ingressInput);
    observed.add(env.identityLock.triggerMessage.platformMessageIdentity.value);
    writer.ingest(env);
  }
  const missing = expected.filter((id) => !observed.has(id));
  assert.deepEqual(missing, ["M1"], "the gap is reported explicitly; numeric adjacency proves nothing");
});

test("an agent-authored record inside a multi-message response is never counted as an expected customer message", () => {
  const decoded = decodePddLatestConversationsPayload(latestResponse([
    rec("800000001", "M1", "客户消息", "1700001000"),
    { from: { role: "mall_cs", uid: "900000001" }, to: { role: "user", uid: "800000001" }, content: "客服回复", msg_id: "M9", ts: "1700001001", type: 0, version: 1 },
  ]));
  const inbound = decoded.messages.filter((m) => m.classification === "CUSTOMER_INBOUND");
  const other = decoded.messages.filter((m) => m.classification !== "CUSTOMER_INBOUND");
  assert.equal(inbound.length, 1);
  assert.equal(other.length, 1);
});