import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("send failure -> refill/retry once (GF-ORCH-008)", async () => {
  const h = buildHarness({ mode: "full_auto" });
  h.platform.sendError = true;
  await h.orc.onBuyerMessage("s1", "c1", { message_id: "m1", content: "有货吗" });
  const ev = h.bus.events();
  assert.ok(ev.includes("SendFailed"));
  assert.ok(ev.includes("SendStarted"));
  const d = lastDecision(h.orc);
  assert.equal(d.decision, "refill_on_failure");
});
