import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("Enter manual send -> MANUAL feedback (GF-ORCH-004)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { mode: "human_review", suggestion: { reply: "亲,有的~", generation: 1 } } } });
  await h.orc.onManualSend("s1", "c1", "Enter");
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "send");
  assert.equal(d.trust, "HUMAN_CONFIRMED");
  assert.ok(h.feedback.classes.includes("MANUAL"));
});
