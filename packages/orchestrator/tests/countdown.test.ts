import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("countdown zero -> auto send + AUTO feedback (GF-ORCH-006)", async () => {
  const h = buildHarness({
    mode: "human_review",
    initialState: { "s1\u0000c1": { mode: "human_review", suggestion: { reply: "亲,有的~", generation: 1 }, countdown: { enabled: true, remaining_ticks: 5, tick_ms: 1000 } } },
  });
  await h.orc.onCountdownElapsed("s1", "c1", 5000);
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "auto_send");
  assert.equal(d.trust, "AUTO");
  assert.ok(h.feedback.classes.includes("AUTO"));
});
