// SHEEP-301: `/plateau/chat/list` history window decoding, overlap accounting and canonical
// adaptation.
//
// Grounding: `fixtures/pdd-transport/chat-list.synthetic.json` mirrors the field names, nesting
// and types of a real captured window (single controlled store, read-only, 2026-09-20). EVERY
// value in it is synthetic - the fixture is explicitly marked `synthetic: true` and the first
// test fails closed if that marker is absent, so a real payload can never be mistaken for it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PddChatListWindowAccumulator, decodePddChatListPayload } from "../dist/main/platforms/pdd/pdd-chat-list-transport.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const fixture = JSON.parse(readFileSync(join(FIXTURES, "chat-list.synthetic.json"), "utf8"));

function resolution(value) {
  return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value };
}
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
    association: {
      ownerRuntimeShopId: document.shopId,
      ownerScope: scope(),
      platformCustomerId: message.customerUid,
      platformMessageId: message.platformMessageId,
      internalConversationId: resolution("conversation-" + message.customerUid),
      localMessageId: resolution("local-" + message.platformMessageId),
    },
  };
}
const document = () => ({ sessionId: "pdd-session-shop-test", shopId: "shop-test", documentGeneration: 1 });

function mapCandidate(candidate, canonicalValidator = undefined) {
  return processPddInboundIngress({
    document: document(),
    input: candidate.ingressInput,
    resolveScope: scope,
    resolveIdentity: identityFor,
    canonicalValidator,
  });
}

test("fixture is explicitly synthetic (a real payload can never be mistaken for it)", () => {
  assert.equal(fixture.synthetic, true);
  assert.equal(typeof fixture._fixture, "string");
  assert.match(fixture._fixture, /SYNTHETIC/);
});

test("per-item processing: every window item is classified in order and individually", () => {
  const decoded = decodePddChatListPayload(fixture.window_a);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.messages.length, 11, "all 11 window items are processed individually");
  assert.deepEqual(
    decoded.messages.map((message) => message.classification),
    ["NOT_CUSTOMER_ORIGINATED", "CUSTOMER_INBOUND", "CUSTOMER_INBOUND", "CUSTOMER_INBOUND", "NOT_CUSTOMER_ORIGINATED",
      "CUSTOMER_INBOUND", "CUSTOMER_INBOUND", "CUSTOMER_INBOUND", "CUSTOMER_INBOUND", "CUSTOMER_INBOUND", "CUSTOMER_INBOUND"],
  );
  assert.equal(decoded.window.messageCount, 11);
  assert.equal(decoded.window.inboundCandidates, 9);
  assert.equal(decoded.window.nonInboundItems, 2);
  assert.equal(decoded.window.unknownDirectionItems, 0);
  assert.equal(decoded.window.distinctMessageIds, 11);
  assert.equal(decoded.window.preMessageIdChainLength, 11);
});

test("customer direction: only user->mall_cs becomes a canonical candidate", () => {
  const decoded = decodePddChatListPayload(fixture.window_a);
  assert.equal(decoded.status, "DECODED");
  for (const message of decoded.messages) {
    if (message.classification === "CUSTOMER_INBOUND") {
      assert.ok(message.ingressInput, "inbound candidate carries a canonical ingress input");
      assert.equal(message.ingressInput.payload.from.role, "user");
      assert.equal(message.ingressInput.payload.to.role, "mall_cs");
      continue;
    }
    assert.equal(message.ingressInput, undefined, "agent/system items never carry an ingress input");
  }
  // Payload identity fields that must never become message data:
  const serialized = JSON.stringify(decoded.messages);
  for (const forbidden of ["mallName", "cs_uid", "is_read", "client_msg_id", "manual_reply"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden + " is not propagated into a candidate");
  }
});

test("unknown time: the raw ts is carried verbatim and the canonical path reports it as unknown", () => {
  const decoded = decodePddChatListPayload(fixture.window_a);
  assert.equal(decoded.status, "DECODED");
  const first = decoded.messages.find((message) => message.classification === "CUSTOMER_INBOUND");
  assert.ok(first && first.ingressInput);
  assert.equal(first.ingressInput.sourceOccurredAt, "1700000002", "raw platform value is passed through unchanged");

  const mapped = mapCandidate(first);
  assert.equal(mapped.status, "MAPPED");
  assert.equal(mapped.envelope.sourceOccurredAt, null, "no time is invented for an out-of-subset value");
  assert.ok(mapped.diagnostics.includes("SOURCE_TIME_INVALID"));

  const isoDecoded = decodePddChatListPayload(fixture.window_iso_time);
  assert.equal(isoDecoded.status, "DECODED");
  const isoMapped = mapCandidate(isoDecoded.messages[0]);
  assert.equal(isoMapped.status, "MAPPED");
  assert.equal(isoMapped.envelope.sourceOccurredAt, "2026-09-20T12:48:08Z");
  assert.deepEqual([...isoMapped.diagnostics], []);
});

test("every inbound candidate in the window maps through the existing canonical chain", () => {
  const decoded = decodePddChatListPayload(fixture.window_a);
  assert.equal(decoded.status, "DECODED");
  const inbound = decoded.messages.filter((message) => message.classification === "CUSTOMER_INBOUND");
  let mapped = 0;
  for (const candidate of inbound) {
    const result = mapCandidate(candidate);
    assert.equal(result.status, "MAPPED");
    assert.equal(result.envelope.identityLock.platform, "pdd");
    assert.equal(result.envelope.identityLock.platformCustomerId.status, "RESOLVED");
    assert.equal(result.envelope.identityLock.triggerMessage.platformMessageIdentity.provenance, "AUTHORITATIVE_PLATFORM_ID");
    assert.equal(result.envelope.identityLock.runtimeEvidence.sessionId, "pdd-session-shop-test");
    assert.equal(result.envelope.identityLock.runtimeEvidence.documentGeneration, 1);
    assert.equal(result.diagnostics.includes("SOURCE_TIME_INVALID"), true);
    mapped += 1;
  }
  assert.equal(mapped, 9, "one canonical mapping per customer-inbound window item");

  // Unavailable or throwing validators still fail closed on this path.
  const failClosed = mapCandidate(inbound[0], null);
  assert.equal(failClosed.status, "FAILED");
  assert.equal(failClosed.reason, "CANONICAL_VALIDATOR_UNAVAILABLE");
});

test("overlapping windows: only messages not already seen are added", () => {
  const accumulator = new PddChatListWindowAccumulator();
  const first = accumulator.ingest(decodePddChatListPayload(fixture.window_a));
  assert.equal(first.decoded, true);
  assert.equal(first.addedInbound.length, 9);
  assert.equal(first.duplicateInbound, 0);

  const second = accumulator.ingest(decodePddChatListPayload(fixture.window_b));
  assert.equal(second.inboundSeen, 9);
  assert.equal(second.addedInbound.length, 1, "only the message outside the first window is new");
  assert.equal(second.duplicateInbound, 8);

  const repeated = accumulator.ingest(decodePddChatListPayload(fixture.window_a));
  assert.equal(repeated.addedInbound.length, 0, "re-sending the same window adds nothing");
  assert.equal(repeated.duplicateInbound, 9);

  const stats = accumulator.stats();
  assert.equal(stats.windows, 3);
  assert.equal(stats.distinctInboundMessageIds, 10);
  assert.equal(stats.duplicateInbound, 17);
});

test("window facts: has_more, read-mark correlation and pagination anchors are reported as booleans", () => {
  const decoded = decodePddChatListPayload(fixture.window_a);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.window.hadMore, true);
  assert.equal(decoded.window.readMarkPresent, true);
  assert.equal(decoded.window.userLastReadIsOneOfWindowMessageIds, true);
  assert.equal(decoded.window.minSupportedMsgIdIsOneOfWindowMessageIds, true);

  const overlapping = decodePddChatListPayload(fixture.window_b);
  assert.equal(overlapping.status, "DECODED");
  assert.equal(overlapping.window.hadMore, false);
  assert.equal(overlapping.window.userLastReadIsOneOfWindowMessageIds, false);
  assert.equal(overlapping.window.minSupportedMsgIdIsOneOfWindowMessageIds, true);

  const withoutReadMark = decodePddChatListPayload(fixture.window_missing_read_mark);
  assert.equal(withoutReadMark.status, "DECODED");
  assert.equal(withoutReadMark.window.readMarkPresent, false);
  assert.equal(withoutReadMark.window.userLastReadIsOneOfWindowMessageIds, null);
  assert.equal(withoutReadMark.window.hadMore, null, "a non-boolean has_more is reported as unknown, not guessed");

  // Read-state identifiers must never leave the decoder.
  const serialized = JSON.stringify(decoded.window) + JSON.stringify(overlapping.window);
  for (const forbidden of ["SYN-A-003", "SYN-A-011", "SYN-NOT-IN-WINDOW", "SYN-A-004"]) {
    assert.equal(serialized.includes(forbidden), false, "read-mark identifier is not returned");
  }
});

test("edge cases: malformed rows, unknown direction, unknown kind and a missing message id are explicit", () => {
  const decoded = decodePddChatListPayload(fixture.window_edge_cases);
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.window.itemsSkippedMalformed, 1);
  assert.equal(decoded.window.unknownDirectionItems, 1);
  assert.equal(decoded.window.inboundCandidates, 2, "only the type-0 customer items are question candidates");
  assert.equal(decoded.window.inboundWithoutMessageId, 1);
  assert.equal(decoded.window.unknownTypeItems, 2, "the system item and the type-7 item have no kind evidence");
  assert.equal(decoded.messages.length, 4, "malformed rows are skipped, valid rows are all processed");

  const accumulator = new PddChatListWindowAccumulator();
  const accumulation = accumulator.ingest(decoded);
  assert.equal(accumulation.unidentifiedInbound, 1, "a message without an id is reported, never merged");
  assert.equal(accumulation.addedInbound.length, 2);
  assert.deepEqual(accumulation.excludedByKind, { "UNKNOWN_TYPE:UNKNOWN_DIRECTION": 1, "UNKNOWN_TYPE:CUSTOMER_INBOUND": 1 });

  const withoutId = decoded.messages.find((message) => message.classification === "CUSTOMER_INBOUND" && message.ingressInput.payload.msg_id === undefined);
  assert.ok(withoutId);
  const mapped = mapCandidate(withoutId);
  assert.notEqual(mapped.status, "MAPPED");
  assert.ok(mapped.diagnostics.includes("PLATFORM_MESSAGE_ID_MISSING"), "a missing id stays explicit");

  const emptyContent = decoded.messages.find((message) => message.classification === "CUSTOMER_INBOUND" && message.ingressInput.payload.msg_id === "SYN-EDGE-2");
  assert.ok(emptyContent);
  const rejected = mapCandidate(emptyContent);
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.reason, "content_missing_or_invalid");
});

test("unsupported shapes return explicit reasons instead of guessing", () => {
  const cases = [
    [fixture.window_unsupported_not_json, "PAYLOAD_NOT_JSON"],
    [{ "a": 1 }, "PAYLOAD_NOT_SUCCESSFUL"],
    [fixture.window_unsupported_not_successful, "PAYLOAD_NOT_SUCCESSFUL"],
    [fixture.window_unsupported_missing_result, "RESULT_MISSING"],
    [fixture.window_unsupported_messages_not_array, "MESSAGES_NOT_ARRAY"],
  ];
  for (const [input, reason] of cases) {
    const decoded = decodePddChatListPayload(input);
    assert.equal(decoded.status, "UNSUPPORTED");
    assert.equal(decoded.reason, reason);
  }
  const skipped = new PddChatListWindowAccumulator().ingest(decodePddChatListPayload(fixture.window_unsupported_missing_result));
  assert.equal(skipped.decoded, false);
  assert.equal(skipped.unsupportedReason, "RESULT_MISSING");
  assert.equal(skipped.addedInbound.length, 0);
});

// Recall / non-question boundary, decided by the PLATFORM `type` field only.
//
// Evidence for the type values (loaded client bundle, read-only): a withdrawn message is rendered as
// `type: 31` with `info.mall_content = withdraw_hint`; `type: 24` is handled specially and
// `type: 26..29/32` exist as other message kinds; text content is carried with `type: 0`.
//
// Boundary under test: a recall notice (or any non-text / unknown platform type) is NOT a customer
// question - it gets no ingress input, is never accumulated and is never mapped - while ordinary
// text messages keep flowing. The kind is never derived from the message wording.
test("a recall notice is not a customer question, and the kind comes from the platform type field", () => {
  const recallWindow = {
    success: true,
    result: {
      response: "succ", request_id: 9, result: "ok", has_more: false,
      messages: [
        { from: { role: "user", uid: "900000001" }, to: { role: "mall_cs", uid: "1000000000003" }, content: "SYNTHETIC-WITHDRAW-HINT", status: "normal", is_aut: 0, ts: "1700000009", type: 31, client_msg_id: "syn-client-recall", is_read: 1, version: 1, msg_id: "SYN-RECALL-1", mallName: "SYNTHETIC-MALL", manual_reply: 0, mall_context: {}, cs_type: 0, pre_msg_id: "SYN-A-011" },
        { from: { role: "user", uid: "900000001" }, to: { role: "mall_cs", uid: "1000000000003" }, content: "SYNTHETIC-ORDINARY-1", status: "normal", is_aut: 0, ts: "1700000010", type: 0, client_msg_id: "syn-client-ordinary", is_read: 1, version: 1, msg_id: "SYN-ORDINARY-1", mallName: "SYNTHETIC-MALL", manual_reply: 0, mall_context: {}, cs_type: 0, pre_msg_id: "SYN-RECALL-1" },
      ],
      cs_infos: [],
    },
  };
  const decoded = decodePddChatListPayload(recallWindow);
  assert.equal(decoded.status, "DECODED");
  assert.deepEqual(decoded.messages.map((message) => message.kind), ["RECALL_NOTICE", "TEXT"]);
  assert.deepEqual(decoded.messages.map((message) => message.platformType), [31, 0]);

  // The recall notice is recognised but NOT offered to the canonical chain.
  const recall = decoded.messages[0];
  assert.equal(recall.classification, "CUSTOMER_INBOUND", "direction is still reported for the trace");
  assert.equal(recall.ingressInput, undefined, "a recall notice never becomes a canonical candidate");
  assert.equal(decoded.window.recallNoticeItems, 1);
  assert.equal(decoded.window.textItems, 1);
  assert.deepEqual(decoded.window.platformTypeCounts, { "31": 1, "0": 1 });

  // The ordinary text message still maps normally.
  const mapped = mapCandidate(decoded.messages[1]);
  assert.equal(mapped.status, "MAPPED");
  assert.equal(mapped.envelope.sourceContent.kind, "text");

  // The accumulator counts the excluded item instead of dropping it silently.
  const accumulator = new PddChatListWindowAccumulator();
  const accumulation = accumulator.ingest(decoded);
  assert.equal(accumulation.addedInbound.length, 1, "only the text message is a candidate");
  assert.deepEqual(accumulation.excludedByKind, { "RECALL_NOTICE:CUSTOMER_INBOUND": 1 });
  assert.deepEqual(accumulator.stats().excludedByKindTotals, { "RECALL_NOTICE:CUSTOMER_INBOUND": 1 });
});

test("the item kind is decided by the platform type field, never by the message wording", () => {
  const makeItem = (type: unknown, content: string) => ({ from: { role: "user", uid: "900000001" }, to: { role: "mall_cs", uid: "1000000000003" }, content, type, msg_id: "SYN-KIND-1", ts: "1700000009" });
  const wrap = (item: object) => ({ success: true, result: { response: "succ", request_id: 1, result: "ok", has_more: false, messages: [item], cs_infos: [] } });

  // Wording that LOOKS like a recall hint is still a text question when the platform says type 0.
  const textual = decodePddChatListPayload(wrap(makeItem(0, "你撤回了一条消息")));
  assert.equal(textual.status, "DECODED");
  assert.equal(textual.messages[0].kind, "TEXT");
  assert.ok(textual.messages[0].ingressInput);

  // Ordinary wording with a recall type is a recall notice, not a question.
  const typed = decodePddChatListPayload(wrap(makeItem(31, "SYNTHETIC-ORDINARY-1")));
  assert.equal(typed.messages[0].kind, "RECALL_NOTICE");
  assert.equal(typed.messages[0].ingressInput, undefined);

  // Known non-text kinds and unknown kinds never become questions, and are reported.
  for (const platformType of [24, 26, 27, 28, 29, 32]) {
    const decoded = decodePddChatListPayload(wrap(makeItem(platformType, "SYNTHETIC-ORDINARY-1")));
    assert.equal(decoded.messages[0].kind, "NON_TEXT_MESSAGE", "type " + platformType + " is a known non-text kind");
    assert.equal(decoded.messages[0].ingressInput, undefined);
  }
  for (const platformType of [7, 99, undefined, "0"]) {
    const decoded = decodePddChatListPayload(wrap(makeItem(platformType, "SYNTHETIC-ORDINARY-1")));
    assert.equal(decoded.messages[0].kind, "UNKNOWN_TYPE", "type " + String(platformType) + " has no evidence: explicit unknown");
    assert.equal(decoded.messages[0].ingressInput, undefined, "unknown kinds are never admitted as questions");
    assert.equal(decoded.window.unknownTypeItems, 1);
  }
});
