import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("per-conversation send serialization (GF-ORCH-015)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { mode: "human_review", sending: true, suggestion: { reply: "亲,有的~", generation: 1 } } } });
  await h.orc.onSendRequest("s1", "c1", { reply: "亲,有的~", generation: 1 });
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "serialized_wait");
});
