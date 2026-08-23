import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("stale AI result ignored (GF-ORCH-012)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { mode: "human_review", current_generation: 2 } } });
  await h.orc.onAiResult("s1", "c1", { generation: 1, reply: "old" });
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "ignore_stale");
  assert.equal(h.platform.sendCallCount, 0);
  assert.equal(h.feedback.count, 0);
});
