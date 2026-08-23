import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("pre-send regenerate on Enter (GF-ORCH-009)", async () => {
  const h = buildHarness({
    mode: "human_review",
    aiScript: [{ reply: "<regenerated>", generation: 2 }],
    initialState: { ["s1\u0000c1"]: { mode: "human_review", current_generation: 1, suggestion: { reply: "old", generation: 1 } } },
  });
  h.platform.newMessageAfterSuggestion = true;
  await h.orc.onManualSend("s1", "c1", "Enter");
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "regenerate_before_send");
  assert.equal(d.generation, 2);
});
