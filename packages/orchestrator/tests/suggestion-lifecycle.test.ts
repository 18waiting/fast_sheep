import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("buyer message -> human-review suggestion (GF-ORCH-001)", async () => {
  const h = buildHarness({ mode: "human_review" });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", buyer: "张三", content: "有货吗" });
  assert.ok(h.bus.events().includes("SuggestionReady"));
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "suggestion_ready");
  assert.equal(d.mode, "human_review");
});
