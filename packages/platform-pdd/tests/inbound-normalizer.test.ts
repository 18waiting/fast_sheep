import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePddInbound, normalizePddInboundForCanonical } from "../dist/inbound-normalizer.js";

const valid = () => ({
  content: "  有货吗？\n",
  from: { role: "user", uid: "6318084722818" },
  to: { role: "mall_cs", uid: "opaque-cs-1" },
  msg_id: "pdd-msg-1",
  client_msg_id: "client-msg-1",
  pre_msg_id: "opaque-prev",
  target_id: "opaque-target",
});

test("normalizes a buyer text payload without conversation association", () => {
  const result = normalizePddInbound({ ...valid(), msg_id: "987654321098765432109876543210", unexpected_secret_like_field: "redacted-test-value" });
  assert.equal(result.status, "NORMALIZED");
  if (result.status !== "NORMALIZED") return;
  assert.equal(result.candidate.direction, "inbound");
  assert.equal(result.candidate.customerUid, "6318084722818");
  assert.equal(result.candidate.platformMessageId, "987654321098765432109876543210");
  assert.equal(result.candidate.content, "  有货吗？\n");
  assert.equal(result.candidate.clientMessageId, "client-msg-1");
  assert.equal((result.candidate as Record<string, unknown>).conversation_id, undefined);
  assert.equal(result.candidate.opaquePlatformFields?.toUid, "opaque-cs-1");
  assert.equal(result.candidate.opaquePlatformFields?.targetId, "opaque-target");
  assert.equal((result.candidate as Record<string, unknown>).unexpected_secret_like_field, undefined);
  assert.equal((result.candidate as Record<string, unknown>).from, undefined);
});

test("wrong roles and missing content are rejected", () => {
  assert.equal(normalizePddInbound({ ...valid(), content: undefined }).status, "REJECTED");
  assert.equal(normalizePddInbound({ ...valid(), from: { role: "mall_cs", uid: "buyer-1" } }).status, "REJECTED");
  assert.equal(normalizePddInbound({ ...valid(), to: { role: "user", uid: "buyer-1" } }).status, "REJECTED");
});

test("missing or malformed identity facts are unknown, not success", () => {
  for (const uid of [undefined, 1, "", "   ", "-1", "1.5", "1e3", "buyer-1", " 6318084722818"]) {
    assert.equal(normalizePddInbound({ ...valid(), from: { role: "user", uid } }).status, "UNKNOWN");
  }
  assert.equal(normalizePddInbound({ ...valid(), msg_id: undefined }).status, "UNKNOWN");
  assert.equal(normalizePddInbound({ ...valid(), msg_id: 1 }).status, "UNKNOWN");
});

test("missing message id never receives a fallback platform identity", () => {
  const result = normalizePddInbound({ ...valid(), msg_id: undefined });
  assert.deepEqual(result, { status: "UNKNOWN", reason: "platform_message_id_missing_or_invalid" });
  assert.equal(normalizePddInbound({ ...valid(), msg_id: "" }).status, "UNKNOWN");
  assert.equal(normalizePddInbound({ ...valid(), msg_id: "   " }).status, "UNKNOWN");
});

test("client message id is optional and is not an idempotency claim", () => {
  const result = normalizePddInbound({ ...valid(), client_msg_id: undefined });
  assert.equal(result.status, "NORMALIZED");
  if (result.status !== "NORMALIZED") return;
  assert.equal(result.candidate.clientMessageId, undefined);
  assert.equal((result.candidate as Record<string, unknown>).idempotencyKey, undefined);
});

test("repeated payloads normalize independently without replay or dedup semantics", () => {
  const first = normalizePddInbound(valid());
  const second = normalizePddInbound(valid());
  assert.deepEqual(first, second);
});


test("canonical-ingress normalization accepts missing identity facts while preserving the inbound fact", () => {
  const result = normalizePddInboundForCanonical({
    content: "  有货吗？\n",
    from: { role: "user" },
    to: { role: "mall_cs" },
  });
  assert.deepEqual(result, {
    status: "ACCEPTED",
    value: {
      direction: "inbound",
      content: "  有货吗？\n",
      diagnostics: ["CUSTOMER_UID_MISSING", "PLATFORM_MESSAGE_ID_MISSING"],
    },
  });
});

test("canonical-ingress normalization rejects present-but-invalid identity facts", () => {
  assert.deepEqual(normalizePddInboundForCanonical({ content: "x", from: { role: "user", uid: "buyer-1" }, to: { role: "mall_cs" }, msg_id: "m1" }), {
    status: "REJECTED",
    reason: "customer_uid_invalid",
    diagnostics: [],
  });
  assert.deepEqual(normalizePddInboundForCanonical({ content: "x", from: { role: "user", uid: "1" }, to: { role: "mall_cs" }, msg_id: " " }), {
    status: "REJECTED",
    reason: "platform_message_id_invalid",
    diagnostics: [],
  });
});

test("canonical-ingress normalization preserves content exactly", () => {
  const content = "  " + "x".repeat(5000) + "\n";
  const result = normalizePddInboundForCanonical({
    content,
    from: { role: "user", uid: "1" },
    to: { role: "mall_cs" },
    msg_id: "m1",
  });
  assert.equal(result.status, "ACCEPTED");
  if (result.status !== "ACCEPTED") return;
  assert.equal(result.value.content, content);
});


test("canonical-ingress normalization rejects wrong roles and contradictory direction", () => {
  assert.equal(normalizePddInboundForCanonical({ content: "x", from: { role: "mall_cs", uid: "1" }, to: { role: "mall_cs" }, msg_id: "m1" }).status, "REJECTED");
  assert.equal(normalizePddInboundForCanonical({ content: "x", from: { role: "user", uid: "1" }, to: { role: "user" }, msg_id: "m1" }).status, "REJECTED");
  assert.deepEqual(normalizePddInboundForCanonical({ direction: "outbound", content: "x", from: { role: "user", uid: "1" }, to: { role: "mall_cs" }, msg_id: "m1" }), {
    status: "REJECTED",
    reason: "direction_not_inbound",
    diagnostics: [],
  });
  assert.equal(normalizePddInboundForCanonical({ direction: "unknown", content: "x", from: { role: "user", uid: "1" }, to: { role: "mall_cs" }, msg_id: "m1" }).status, "REJECTED");
});
