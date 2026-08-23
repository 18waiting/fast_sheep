import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";
import { COMMAND_HANDLERS, type CommandDeps } from "../dist/main/ipc/command-handlers.js";
import type { WorkerJobClientPort } from "@fastwork/background-jobs";

test("learning.start schedules a Worker learning.run job and completes it", async () => {
  const calls: string[] = [];
  const workerJobClient: WorkerJobClientPort = {
    run: async (type, request) => { calls.push(type + ":" + JSON.stringify(request)); return { ok: true, trace: [] }; },
  };
  const ctx = createMainContext({ testMode: true, workerJobClient });
  const handler = COMMAND_HANDLERS["learning.start"](ctx as unknown as CommandDeps);
  const res = await handler({ import_source: "synthetic_chat.txt" });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.ok(res.data.job_id.length > 0);
    await ctx.learning.run(res.data.job_id);
    const job = ctx.jobs.get(res.data.job_id);
    assert.equal(job?.state, "COMPLETED");
  }
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith("learning:"));
  const payload = JSON.parse(calls[0].slice("learning:".length));
  assert.equal(payload.import_source, "synthetic_chat.txt");
});

test("learning job failure marks the job FAILED and records the worker error", async () => {
  const workerJobClient: WorkerJobClientPort = {
    run: async () => { throw new Error("worker boom"); },
  };
  const ctx = createMainContext({ testMode: true, workerJobClient });
  const res = await COMMAND_HANDLERS["learning.start"](ctx as unknown as CommandDeps)({});
  assert.equal(res.ok, true);
  if (res.ok) {
    await ctx.learning.run(res.data.job_id);
    const job = ctx.jobs.get(res.data.job_id);
    assert.equal(job?.state, "FAILED");
    assert.ok(String(job?.error ?? "").includes("worker boom"));
  }
});
