import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("full auto sends on suggestion (GF-ORCH-002)", async () => {
  const h = buildHarness({ mode: "full_auto" });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  const ev = h.bus.events();
  assert.ok(ev.includes("SuggestionReady"));
  assert.ok(ev.includes("SendStarted"));
  assert.ok(ev.includes("SendCompleted"));
  assert.ok(h.platform.sendCallCount >= 1);
});

test("switch human-review -> full-auto sends pending (GF-ORCH-003)", async () => {
  const h = buildHarness({ mode: "human_review" });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  await h.orc.onSetMode("s1", "c1", "full_auto");
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "pending_suggestion_sent");
  assert.ok(h.bus.events().includes("SendStarted"));
});
