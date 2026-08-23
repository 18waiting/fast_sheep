import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("segmented send 800ms virtual spacing (GF-ORCH-SEG-001)", async () => {
  const h = buildHarness({ mode: "full_auto", segmentIntervalMs: 800 });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  // FakePlatformAdapter records virtualTimeMs via its clock
  assert.ok(h.platform.sendCallCount >= 1);
  const { SegmentedSendPolicy } = await import("../dist/index.js");
  const parts = new SegmentedSendPolicy().split("亲,您好###这个可以帮您###请稍等", 800);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts.map((p) => p.virtualTimeMs), [0, 800, 1600]);
});

test("pure separator no send (GF-ORCH-SEG-002)", async () => {
  const { SegmentedSendPolicy } = await import("../dist/index.js");
  const parts = new SegmentedSendPolicy().split("###", 800);
  assert.equal(parts.length, 0);
});
