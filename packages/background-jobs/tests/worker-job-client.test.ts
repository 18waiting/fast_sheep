import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkerJobClient } from "../dist/index.js";
import type { AIWorkerClient } from "@fastwork/worker-rpc";

test("maps base types to canonical RPC methods", async () => {
  const calls: string[] = [];
  const worker = {
    request: async (method: string) => { calls.push(method); return { ok: true }; },
  } as unknown as AIWorkerClient;
  const client = new WorkerJobClient(worker);
  await client.run("learning", {});
  await client.run("review", {});
  await client.run("audit", {});
  await client.run("optimization", {});
  assert.deepEqual(calls, ["learning.run", "review.propose", "audit.decide", "optimization.propose"]);
});

test("dotted types pass through as full method names", async () => {
  const calls: string[] = [];
  const worker = {
    request: async (method: string) => { calls.push(method); return { ok: true }; },
  } as unknown as AIWorkerClient;
  const client = new WorkerJobClient(worker);
  await client.run("review.apply", {});
  await client.run("review.restore", {});
  assert.deepEqual(calls, ["review.apply", "review.restore"]);
});
