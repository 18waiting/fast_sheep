import { test } from "node:test";
import assert from "node:assert/strict";
import { OrchestratorFeedbackSink } from "../dist/index.js";

test("orchestrator sink forwards intents to the service", async () => {
  let handled = null;
  const service = { handle: async (intent) => { handled = intent; } } as never;
  const sink = new OrchestratorFeedbackSink(service);
  sink.record({ class: "MANUAL", trust: "HUMAN_CONFIRMED", conversationId: "c1" });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(handled);
});
