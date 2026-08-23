// M5 end-to-end: message -> suggestion -> manual send -> FeedbackIntent -> SENT, and full-auto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness } from "./helpers.ts";

test("M5 end-to-end human-review path", async () => {
  const h = buildHarness({ mode: "human_review" });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", buyer: "张三", content: "有货吗" });
  assert.ok(h.bus.events().includes("SuggestionReady"));
  await h.orc.onManualSend("s1", "c1", "Enter");
  assert.ok(h.platform.sendCallCount >= 1);
  assert.ok(h.feedback.classes.includes("MANUAL"));
  assert.ok(h.bus.events().includes("SendCompleted"));
});

test("M5 end-to-end full-auto path", async () => {
  const h = buildHarness({ mode: "full_auto" });
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "发货多久" });
  assert.ok(h.platform.sendCallCount >= 1);
  assert.ok(h.feedback.classes.includes("AUTO"));
});
