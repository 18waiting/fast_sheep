import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("manual takeover invalidates in-flight AI (GF-ORCH-010)", async () => {
  const h = buildHarness({ mode: "human_review", initialState: { "s1\u0000c1": { ai_inflight: true } } });
  await h.orc.onHumanTakeover("s1", "c1");
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "takeover");
  assert.ok(h.bus.events().includes("HumanTakeover"));
  assert.equal(h.platform.sendCallCount, 0);
});
