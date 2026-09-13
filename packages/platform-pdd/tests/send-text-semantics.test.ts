import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PDD_SEND_TARGET_KIND,
  unknownOutcomeDirective,
  validatePddSendIntent,
  validatePddSendState,
} from "../dist/send-text-semantics.js";

const validInput = (content = "  [synthetic pdd text]\n") => ({
  target: { kind: PDD_SEND_TARGET_KIND, customerUid: "900000000000000001" },
  content,
});

const state = (
  localValidation: "VALID" | "REJECTED",
  platformAttempt: "NOT_ATTEMPTED" | "ATTEMPTED" | "UNKNOWN",
  platformOutcome: "NOT_ATTEMPTED" | "PLATFORM_APPLICATION_ACCEPTED" | "PLATFORM_REJECTED" | "UNKNOWN",
) => ({ localValidation, platformAttempt, platformOutcome });

test("valid PDD customer target and exact text produce a local VALID intent", () => {
  const result = validatePddSendIntent(validInput());
  assert.equal(result.status, "VALID");
  if (result.status !== "VALID") return;
  assert.equal(result.intent.target.kind, "PDD_CUSTOMER_UID");
  assert.equal(result.intent.target.customerUid, "900000000000000001");
  assert.equal(result.intent.content, "  [synthetic pdd text]\n");
});

test("customerUid remains an exact string, including a long value", () => {
  const customerUid = "900000000000000001234567890123456789";
  const result = validatePddSendIntent({ ...validInput(), target: { kind: PDD_SEND_TARGET_KIND, customerUid } });
  assert.equal(result.status, "VALID");
  if (result.status !== "VALID") return;
  assert.equal(result.intent.target.customerUid, customerUid);
  assert.equal(typeof result.intent.target.customerUid, "string");
});

test("the independent intent has no conversation identity or transport fields", () => {
  const result = validatePddSendIntent({ ...validInput(), conversation_id: "must-not-escape", request_id: "transport-only" });
  assert.equal(result.status, "VALID");
  if (result.status !== "VALID") return;
  assert.deepEqual(Object.keys(result.intent), ["target", "content"]);
  assert.equal("conversation_id" in result.intent, false);
  assert.equal("conversationId" in result.intent, false);
  assert.equal("request_id" in result.intent, false);
  assert.equal("random" in result.intent, false);
  assert.equal("hash" in result.intent, false);
  assert.equal("anti_content" in result.intent, false);
});

test("invalid target and invalid text are local REJECTED results", () => {
  assert.deepEqual(validatePddSendIntent({ ...validInput(), target: { kind: PDD_SEND_TARGET_KIND, customerUid: "buyer-1" } }), {
    status: "REJECTED", reason: "customer_uid_missing_or_invalid",
  });
  assert.deepEqual(validatePddSendIntent({ ...validInput(), content: "" }), {
    status: "REJECTED", reason: "content_missing_or_invalid",
  });
  assert.deepEqual(validatePddSendIntent({ ...validInput(), content: undefined }), {
    status: "REJECTED", reason: "content_missing_or_invalid",
  });
});

test("local REJECTED is not PLATFORM_REJECTED and valid non-attempt is representable", () => {
  const localRejected = validatePddSendState(state("REJECTED", "NOT_ATTEMPTED", "NOT_ATTEMPTED"));
  assert.equal(localRejected.status, "VALID");
  if (localRejected.status === "VALID") assert.notEqual(localRejected.state.platformOutcome, "PLATFORM_REJECTED");
  assert.equal(validatePddSendState(state("VALID", "NOT_ATTEMPTED", "NOT_ATTEMPTED")).status, "VALID");
});

test("accepted, rejected, and unknown platform outcomes are representable only after an attempt", () => {
  assert.equal(validatePddSendState(state("VALID", "ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED")).status, "VALID");
  assert.equal(validatePddSendState(state("VALID", "ATTEMPTED", "PLATFORM_REJECTED")).status, "VALID");
  assert.equal(validatePddSendState(state("VALID", "ATTEMPTED", "UNKNOWN")).status, "VALID");
  assert.equal(validatePddSendState(state("VALID", "UNKNOWN", "UNKNOWN")).status, "VALID");
});

test("contradictory state combinations are rejected", () => {
  assert.equal(validatePddSendState(state("REJECTED", "ATTEMPTED", "PLATFORM_REJECTED")).status, "REJECTED");
  assert.equal(validatePddSendState(state("REJECTED", "NOT_ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED")).status, "REJECTED");
  assert.equal(validatePddSendState(state("VALID", "NOT_ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED")).status, "REJECTED");
  assert.equal(validatePddSendState(state("VALID", "NOT_ATTEMPTED", "PLATFORM_REJECTED")).status, "REJECTED");
  assert.equal(validatePddSendState(state("VALID", "NOT_ATTEMPTED", "UNKNOWN")).status, "REJECTED");
  assert.equal(validatePddSendState(state("VALID", "ATTEMPTED", "NOT_ATTEMPTED")).status, "REJECTED");
  assert.equal(validatePddSendState(state("VALID", "UNKNOWN", "PLATFORM_APPLICATION_ACCEPTED")).status, "REJECTED");
  assert.equal(validatePddSendState({
    ...state("VALID", "NOT_ATTEMPTED", "NOT_ATTEMPTED"),
    platformResult: { platformMessageId: "unexpected" },
  }).status, "REJECTED");
});

test("UNKNOWN carries the no-automatic-retry semantic directive", () => {
  assert.equal(unknownOutcomeDirective("UNKNOWN"), "NO_AUTOMATIC_RETRY");
  assert.equal(unknownOutcomeDirective("PLATFORM_APPLICATION_ACCEPTED"), undefined);
});

test("platformMessageId is optional, exact, non-empty, and opaque", () => {
  const accepted = validatePddSendState({
    ...state("VALID", "ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED"),
    platformResult: { platformMessageId: "  synthetic-platform-message-1  " },
  });
  assert.equal(accepted.status, "VALID");
  if (accepted.status !== "VALID") return;
  assert.equal(accepted.state.platformResult?.platformMessageId, "  synthetic-platform-message-1  ");
  assert.deepEqual(Object.keys(accepted.state.platformResult ?? {}), ["platformMessageId"]);
  assert.equal("conversationId" in (accepted.state.platformResult ?? {}), false);
  assert.equal("messageId" in (accepted.state.platformResult ?? {}), false);
  assert.equal("idempotencyKey" in (accepted.state.platformResult ?? {}), false);
});

test("empty or whitespace-only platformMessageId is invalid and no fallback is generated", () => {
  for (const platformMessageId of ["", "   "]) {
    assert.deepEqual(validatePddSendState({
      ...state("VALID", "ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED"),
      platformResult: { platformMessageId },
    }), { status: "REJECTED", reason: "platform_message_id_invalid" });
  }
  const withoutId = validatePddSendState(state("VALID", "ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED"));
  assert.equal(withoutId.status, "VALID");
  if (withoutId.status === "VALID") assert.equal(withoutId.state.platformResult, undefined);
});

test("preMsgId is omitted from the stable contract and arbitrary opaque payloads are rejected", () => {
  const withObject = {
    ...state("VALID", "ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED"),
    platformResult: { platformMessageId: "synthetic-platform-message-1", preMsgId: { opaque: true } },
  } as never;
  assert.deepEqual(validatePddSendState(withObject), { status: "REJECTED", reason: "platform_result_invalid" });
  const withArray = {
    ...state("VALID", "ATTEMPTED", "UNKNOWN"),
    platformResult: { preMsgId: ["raw", "payload"] },
  } as never;
  assert.deepEqual(validatePddSendState(withArray), { status: "REJECTED", reason: "platform_result_invalid" });
});

test("delivery/read states do not exist", () => {
  const accepted = validatePddSendState(state("VALID", "ATTEMPTED", "PLATFORM_APPLICATION_ACCEPTED"));
  assert.equal(accepted.status, "VALID");
  if (accepted.status !== "VALID") return;
  assert.equal("DELIVERED" in accepted.state, false);
  assert.equal("READ" in accepted.state, false);
});
