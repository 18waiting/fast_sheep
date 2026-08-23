import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkerOptimizationClient } from "../dist/index.js";
import type { AIWorkerClient } from "@fastwork/worker-rpc";

test("client calls optimization.propose only", async () => {
  const calls: string[] = [];
  const worker = {
    request: async (method: string, payload: unknown) => { calls.push(method + ":" + JSON.stringify(payload)); return { proposal: { detail: "x" } }; },
  } as unknown as AIWorkerClient;
  const client = new WorkerOptimizationClient(worker);
  const res = await client.propose({ product_id: "10001" });
  assert.deepEqual(calls, ['optimization.propose:{"product_id":"10001"}']);
  assert.equal((res as any).proposal.detail, "x");
});
