import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("Alt+Enter -> NO_SAVE, no feedback persistence (GF-ORCH-005)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { mode: "human_review", suggestion: { reply: "亲,有的~", generation: 1 } } } });
  await h.orc.onManualSend("s1", "c1", "Alt+Enter");
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "send_no_save");
  assert.equal(h.feedback.count, 0);
  assert.ok(h.platform.sendCallCount >= 1);
});
