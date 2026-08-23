import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("new message invalidates suggestion + advances generation (GF-ORCH-011)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { mode: "human_review", current_generation: 1, suggestion: { reply: "old", generation: 1 } } } });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m2", content: "再问一个" });
  const ds = decisions(h.orc);
  const inv = ds.find((d) => d.decision === "invalidate_suggestion");
  assert.ok(inv, "invalidate_suggestion decision missing: " + JSON.stringify(ds));
  assert.equal(inv.generation, 2);
});
