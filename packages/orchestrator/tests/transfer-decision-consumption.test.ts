import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("TransferDecision consumed via platform adapter boundary", async () => {
  const h = buildHarness({ mode: "human_review", aiScript: [{ reply: "请稍等", decision: { requested: true, target: "售后" } }] });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "我要退款" });
  assert.ok(h.platform.transferCalls.length >= 1);
  assert.equal(h.platform.transferCalls[0].decision.target, "售后");
});
