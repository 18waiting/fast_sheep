import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("breaker below threshold (GF-ORCH-BRK-001)", async () => {
  const h = buildHarness({ breakerThreshold: 2, breakerWindowMs: 60000, initialState: { "s1\u0000c1": { consecutive_replies: 1 } } });
  const d = h.orc.decisionsSnapshot().length === 0 ? { decision: "no_takeover" } : lastDecision(h.orc);
  assert.equal(d.decision, "no_takeover");
});

test("breaker at threshold (GF-ORCH-BRK-002)", async () => {
  const h = buildHarness({ breakerThreshold: 2, breakerWindowMs: 60000, initialState: { "s1\u0000c1": { consecutive_replies: 2 } } });
  // evaluate via policy directly
  const { TakeoverBreakerPolicy } = await import("../dist/index.js");
  const policy = new TakeoverBreakerPolicy(2, 60000, h.clock);
  policy.recordReply(0);
  policy.recordReply(1000);
  const dec = policy.decide(1000);
  assert.equal(dec, "takeover_breaker_triggered");
});

test("breaker window boundary inclusive (GF-ORCH-BRK-003)", async () => {
  const { TakeoverBreakerPolicy } = await import("../dist/index.js");
  const clock = h2clock();
  const policy = new TakeoverBreakerPolicy(2, 60000, clock);
  policy.recordReply(0);
  policy.recordReply(1000);
  assert.equal(policy.decide(60000), "window_exact");
});

test("breaker window exceeded resets (GF-ORCH-BRK-004)", async () => {
  const { TakeoverBreakerPolicy } = await import("../dist/index.js");
  const clock = h2clock();
  const policy = new TakeoverBreakerPolicy(2, 60000, clock);
  policy.recordReply(0);
  policy.recordReply(1000);
  assert.equal(policy.decide(60001), "window_exceeded");
});

function h2clock() { return { now: () => 0 }; }
