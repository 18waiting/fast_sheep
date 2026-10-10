import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type PreSendGuardPort,
  type PreSendGuardRequest,
  type PreSendGuardResult,
} from "../dist/index.js";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

function result(allowed: boolean, reason: string): PreSendGuardResult {
  return {
    allowed,
    failures: allowed ? [] : [{ reason: reason as PreSendGuardResult["failures"][number]["reason"] }],
    audit: {
      intent_id: "intent-1",
      intent_hash: "sha256-" + "a".repeat(64),
      plan_id: "plan-1",
      policy_version: "policy-1",
      evidence_id: "evidence-1",
      observed_at: "2026-10-03T00:00:00.000Z",
      evaluated_at: "2026-10-03T00:00:00.000Z",
      allowed,
      reason_codes: allowed ? [] : [reason as PreSendGuardResult["audit"]["reason_codes"][number]],
    },
  };
}

const allowGuard: PreSendGuardPort = {
  async evaluate() {
    return result(true, "IDENTITY_VERIFIED");
  },
};

const denyGuard: PreSendGuardPort = {
  async evaluate() {
    return result(false, "IDENTITY_MISMATCH");
  },
};

const requestFactory = async () => ({}) as PreSendGuardRequest;

test("required guard missing fails closed before SendStarted", async () => {
  const h = buildHarness({ mode: "full_auto", preSendGuardRequired: true });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  assert.ok(h.bus.events().includes("SendFailed"));
  assert.equal(h.bus.events().includes("SendStarted"), false);
  assert.equal(lastDecision(h.orc).decision, "pre_send_guard_missing");
});

test("required guard deny blocks SendStarted", async () => {
  const h = buildHarness({
    mode: "full_auto",
    preSendGuardRequired: true,
    preSendGuard: denyGuard,
    preSendGuardRequestFactory: requestFactory,
  });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  assert.ok(h.bus.events().includes("SendFailed"));
  assert.equal(h.bus.events().includes("SendStarted"), false);
  assert.equal(lastDecision(h.orc).decision, "pre_send_guard_rejected");
  assert.equal(h.platform.sendCallCount, 0);
});

test("required guard allow permits SendStarted", async () => {
  const h = buildHarness({
    mode: "full_auto",
    preSendGuardRequired: true,
    preSendGuard: allowGuard,
    preSendGuardRequestFactory: requestFactory,
  });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  assert.ok(h.bus.events().includes("SendStarted"));
  assert.ok(h.bus.events().includes("SendCompleted"));
  assert.ok(decisions(h.orc).some((entry) => entry.decision === "pre_send_guard_allowed" && entry.guard_audit));
});

test("required guard request construction failure fails closed", async () => {
  const h = buildHarness({
    mode: "full_auto",
    preSendGuardRequired: true,
    preSendGuard: allowGuard,
    preSendGuardRequestFactory: async () => null,
  });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  assert.ok(h.bus.events().includes("SendFailed"));
  assert.equal(h.bus.events().includes("SendStarted"), false);
  assert.equal(lastDecision(h.orc).decision, "pre_send_guard_missing");
});
test("guard-only partial configuration fails closed", async () => {
  const h = buildHarness({
    mode: "full_auto",
    preSendGuard: allowGuard,
  });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  assert.ok(h.bus.events().includes("SendFailed"));
  assert.equal(h.bus.events().includes("SendStarted"), false);
  assert.equal(h.platform.sendCallCount, 0);
  assert.equal(lastDecision(h.orc).decision, "pre_send_guard_missing");
});

test("factory-only partial configuration fails closed", async () => {
  const h = buildHarness({
    mode: "full_auto",
    preSendGuardRequestFactory: requestFactory,
  });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  assert.ok(h.bus.events().includes("SendFailed"));
  assert.equal(h.bus.events().includes("SendStarted"), false);
  assert.equal(h.platform.sendCallCount, 0);
  assert.equal(lastDecision(h.orc).decision, "pre_send_guard_missing");
});

test("real send configuration requires guard-required mode", () => {
  assert.throws(
    () => buildHarness({ mode: "full_auto", realSendEnabled: true }),
    /PreSendGuard required mode is mandatory/,
  );
});

test("AUTO configuration requires guard-required mode", () => {
  assert.throws(
    () => buildHarness({ mode: "full_auto", autoEnabled: true }),
    /PreSendGuard required mode is mandatory/,
  );
});
