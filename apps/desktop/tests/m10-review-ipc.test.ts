import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";
import { COMMAND_HANDLERS, type CommandDeps } from "../dist/main/ipc/command-handlers.js";
import type { WorkerJobClientPort } from "@fastwork/background-jobs";

function makeCtx(calls: string[]) {
  const workerJobClient: WorkerJobClientPort = {
    run: async (type, request) => { calls.push(type + ":" + JSON.stringify(request)); return { ok: true }; },
  };
  return createMainContext({ testMode: true, workerJobClient });
}

test("review.propose / apply / restore route to the exact Worker methods", async () => {
  const calls: string[] = [];
  const ctx = makeCtx(calls);
  const deps = ctx as unknown as CommandDeps;
  const jobIds: string[] = [];
  for (const channel of ["review.propose", "review.apply", "review.restore"] as const) {
    const res = await COMMAND_HANDLERS[channel](deps)({ action: channel.split(".")[1], request: { kb: "A库全自动收录" } });
    assert.equal(res.ok, true);
    if (res.ok) jobIds.push(res.data.job_id);
  }
  for (const jid of jobIds) await ctx.review.run(jid);
  assert.deepEqual(calls.map((c) => c.split(":")[0]), ["review.propose", "review.apply", "review.restore"]);
  for (const jid of jobIds) assert.equal(ctx.jobs.get(jid)!.state, "COMPLETED");
});

test("review jobs are Main-scheduled background jobs and complete through the Worker", async () => {
  const calls: string[] = [];
  const ctx = makeCtx(calls);
  const res = await COMMAND_HANDLERS["review.propose"](ctx as unknown as CommandDeps)({ action: "propose", request: {} });
  assert.equal(res.ok, true);
  if (res.ok) {
    await ctx.review.run(res.data.job_id);
    const job = ctx.jobs.get(res.data.job_id)!;
    assert.equal(job.type, "review");
    assert.equal(job.state, "COMPLETED");
  }
});
