import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("two shops independent (GF-ORCH-013)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { sending: true } } });
  await h.orc.onBuyerMessage("s2", "c2", { message_id: "m1", shop_id: "s2", content: "有货吗" });
  assert.ok(h.bus.events().includes("BuyerMessageReceived"));
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "suggestion_ready");
});
