// SHEEP-301/302: real PDD inbound transport decoding + canonical adapter verification.
//
// Grounding: fixture is a sanitized real capture (single controlled store, read-only,
// dedicated debug Chrome). Field names/nesting/types preserved; values replaced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePddLatestConversationsPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));

function resolution(value) {
  return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value };
}
// Ownership is supplied by trusted Main evidence, NOT by the payload.
const scope = () => ({
  merchantId: resolution("merchant-test"),
  storeId: resolution("store-test"),
  platformAccountId: resolution("account-test"),
});
function identityFor(message, document) {
  return {
    runtimeShop: resolution({ value: document.shopId }),
    scope: scope(),
    runtimeConversationReference: resolution({ value: "runtime-" + message.customerUid }),
    association: message.customerUid === undefined || message.platformMessageId === undefined ? undefined : {
      ownerRuntimeShopId: document.shopId,
      ownerScope: scope(),
      platformCustomerId: message.customerUid,
      platformMessageId: message.platformMessageId,
      internalConversationId: resolution("conversation-" + message.customerUid),
      localMessageId: resolution("local-" + message.platformMessageId),
    },
  };
}
function document(shopId = "shop-test") {
  return { sessionId: "pdd-session-" + shopId, shopId, documentGeneration: 1 };
}

test("agent-authored records are NOT classified as customer inbound", () => {
  const decoded = decodePddLatestConversationsPayload(sample.latest_conversations_agent_message);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.messages.length, 1);
  assert.equal(decoded.messages[0].classification, "NOT_CUSTOMER_ORIGINATED");
  assert.equal(decoded.messages[0].ingressInput, undefined, "no ingress input for own message");
});

test("customer-inbound record decodes to canonical ingress input with authoritative ids", () => {
  const decoded = decodePddLatestConversationsPayload(sample.latest_conversations_customer_inbound);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.messages.length, 2, "both records decoded individually");
  assert.equal(decoded.messages[0].classification, "CUSTOMER_INBOUND");
  assert.equal(decoded.messages[1].classification, "NOT_CUSTOMER_ORIGINATED");

  const input = decoded.messages[0].ingressInput;
  assert.ok(input);
  assert.equal(input.payload.from.role, "user");
  assert.equal(input.payload.from.uid, "800000001");
  assert.equal(input.payload.to.role, "mall_cs");
  assert.equal(input.payload.content, "有货吗");
  assert.equal(input.payload.msg_id, "1700000000005", "authoritative platform msg_id preserved verbatim");
  assert.equal(input.sourceOccurredAt, "1700000005", "platform ts carried as raw value, not fabricated");
});

test("multi-conversation response maps per record and never onto the selected customer", () => {
  const decoded = decodePddLatestConversationsPayload(sample.latest_conversations_multi_conversation);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.messages.length, 2);
  const uids = decoded.messages.map((m) => m.ingressInput.payload.from.uid);
  assert.deepEqual(uids, ["800000001", "800000002"]);
  const msgIds = decoded.messages.map((m) => m.ingressInput.payload.msg_id);
  assert.deepEqual(msgIds, ["1700000000010", "1700000000011"]);
});

test("unsupported payload shapes exit explicitly instead of guessing", () => {
  for (const bad of [sample.unsupported_shape, "{not json", "[]", null, { success: true }, { success: true, result: {} }]) {
    const decoded = decodePddLatestConversationsPayload(bad);
    assert.equal(decoded.status, "UNSUPPORTED");
    assert.equal(typeof decoded.reason, "string");
  }
});

test("decoded customer message reaches the collector through the real mapper and default validator", () => {
  const decoded = decodePddLatestConversationsPayload(sample.latest_conversations_customer_inbound);
  const inbound = decoded.messages.find((m) => m.classification === "CUSTOMER_INBOUND");
  assert.ok(inbound);
  const collected = [];
  const result = processPddInboundIngress({
    document: document(),
    input: inbound.ingressInput,
    resolveScope: () => scope(),
    resolveIdentity: identityFor,
    // undefined -> real canonical schema validator
    canonicalValidator: undefined,
  });
  assert.equal(result.status, "MAPPED", JSON.stringify(result));
  collected.push(result.envelope);
  assert.equal(collected.length, 1);
  const lock = collected[0].identityLock;
  assert.equal(lock.platform, "pdd");
  assert.equal(lock.runtimeShop.value.value, "shop-test", "runtime shop from Main evidence");
  assert.equal(lock.storeId.value, "store-test", "canonical store from Main evidence");
  assert.equal(lock.platformCustomerId.value.value, "800000001");
  assert.equal(lock.triggerMessage.platformMessageIdentity.provenance, "AUTHORITATIVE_PLATFORM_ID");
  assert.equal(lock.triggerMessage.platformMessageIdentity.value, "1700000000005");
  assert.equal(collected[0].sourceContent.text, "有货吗");
  assert.equal(collected[0].sourceOccurredAt, null, "raw second-value ts is not treated as a verified ISO source time");
});

test("agent message cannot enter the canonical path even if forced through the ingress", () => {
  const decoded = decodePddLatestConversationsPayload(sample.latest_conversations_agent_message);
  assert.equal(decoded.messages[0].classification, "NOT_CUSTOMER_ORIGINATED");
  // Force the agent record through as if it had been mis-decoded.
  const agentRecord = sample.latest_conversations_agent_message.result.conversations[0];
  const result = processPddInboundIngress({
    document: document(),
    input: { payload: agentRecord, sourceOccurredAt: agentRecord.ts },
    resolveScope: () => scope(),
    resolveIdentity: identityFor,
    canonicalValidator: undefined,
  });
  assert.notEqual(result.status, "MAPPED", "own/agent message must be rejected by the real normalizer");
  assert.equal(result.status, "REJECTED");
});
