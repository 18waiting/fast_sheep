import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkerKnowledgeFeedbackClient } from "../dist/index.js";

test("worker client sends feedback.apply and maps the result", async () => {
  const worker = { request: async (method, payload) => ({ method, payload, ok: true, knowledge_op: "append", entry_id: "e1", applied: true }) };
  const client = new WorkerKnowledgeFeedbackClient(worker as never);
  const res = await client.apply({ record_id: "r1", conversation_id: "c1", class: "AUTO", trust_level: "AUTO", question: "q", answer: "a", product_id: "1", entry: {}, created_at: "t", retry: false });
  assert.equal(res.ok, true);
  assert.equal(res.knowledge_op, "append");
});
