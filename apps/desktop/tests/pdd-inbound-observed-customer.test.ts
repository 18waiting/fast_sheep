import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePddLatestConversationsPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));

const r = (v) => (v === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value: v });
const scope = () => ({ merchantId: r("merchant-test"), storeId: r("store-test"), platformAccountId: r("account-test") });
function doc(shopId = "shop-test") { return { sessionId: "pdd-session-" + shopId, shopId, documentGeneration: 1 }; }
function identityFor(m, d) {
  return {
    runtimeShop: r({ value: d.shopId }),
    scope: scope(),
    runtimeConversationReference: r({ value: "runtime-" + m.customerUid }),
    association: { ownerRuntimeShopId: d.shopId, ownerScope: scope(), platformCustomerId: m.customerUid, platformMessageId: m.platformMessageId, internalConversationId: r("conversation-" + m.customerUid), localMessageId: r("local-" + m.platformMessageId) },
  };
}

test("OBSERVED customer inbound record decodes and maps through the real path", () => {
  for (const key of ["customer_inbound_observed", "customer_inbound_observed_enriched"]) {
    const decoded = decodePddLatestConversationsPayload(sample[key]);
    assert.equal(decoded.status, "DECODED");
    assert.equal(decoded.messages.length, 1);
    assert.equal(decoded.messages[0].classification, "CUSTOMER_INBOUND", key);
    const input = decoded.messages[0].ingressInput;
    assert.equal(input.payload.from.role, "user");
    assert.equal(input.payload.to.role, "mall_cs");
    assert.equal(input.payload.msg_id, "1700001000001");
    assert.equal(input.payload.content, "在吗");
    assert.equal(input.sourceOccurredAt, "1700001000");

    const result = processPddInboundIngress({ document: doc(), input, resolveScope: () => scope(), resolveIdentity: identityFor, canonicalValidator: undefined });
    assert.equal(result.status, "MAPPED", key + " " + JSON.stringify(result));
    const lock = result.envelope.identityLock;
    assert.equal(lock.triggerMessage.platformMessageIdentity.provenance, "AUTHORITATIVE_PLATFORM_ID");
    assert.equal(lock.triggerMessage.platformMessageIdentity.value, "1700001000001");
    assert.equal(lock.platformCustomerId.value.value, "800000001");
    assert.equal(result.envelope.sourceContent.text, "在吗");
    assert.equal(result.envelope.sourceOccurredAt, null, "raw second-precision ts is not asserted as a verified source time");
  }
});

test("consecutive customer messages decode individually and keep their pre_msg_id linkage", () => {
  const decoded = decodePddLatestConversationsPayload(sample.customer_inbound_consecutive);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.messages.length, 2, "both messages present, none collapsed");
  assert.equal(decoded.messages[0].classification, "CUSTOMER_INBOUND");
  assert.equal(decoded.messages[1].classification, "CUSTOMER_INBOUND");
  const ids = decoded.messages.map((m) => m.ingressInput.payload.msg_id);
  assert.deepEqual(ids, ["1700001010001", "1700001000001"], "distinct authoritative ids preserved");
  // linkage evidence is present in the raw payload and untouched by the decoder
  const raw = sample.customer_inbound_consecutive.result.conversations;
  assert.equal(raw[0].pre_msg_id, raw[1].msg_id, "second message links back to the first via pre_msg_id");
});

test("status/is_aut/type/version do not affect inbound mapping", () => {
  const decoded = decodePddLatestConversationsPayload(sample.customer_inbound_observed);
  const input = decoded.messages[0].ingressInput;
  const result = processPddInboundIngress({ document: doc(), input, resolveScope: () => scope(), resolveIdentity: identityFor, canonicalValidator: undefined });
  assert.equal(result.status, "MAPPED", "read/unread, is_aut and version are not part of the inbound decision");
});

test("unchanged synthetic inbound and agent/malformed cases still behave", () => {
  const agent = decodePddLatestConversationsPayload(sample.latest_conversations_agent_message);
  assert.equal(agent.messages[0].classification, "NOT_CUSTOMER_ORIGINATED");
  const synth = decodePddLatestConversationsPayload(sample.latest_conversations_customer_inbound);
  assert.equal(synth.messages[0].classification, "CUSTOMER_INBOUND");
  const bad = decodePddLatestConversationsPayload(sample.unsupported_shape);
  assert.equal(bad.status, "UNSUPPORTED");
});
