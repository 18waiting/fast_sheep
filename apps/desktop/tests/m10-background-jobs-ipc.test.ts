import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";
import { QUERY_HANDLERS, type QueryDeps } from "../dist/main/ipc/query-handlers.js";
import { COMMAND_HANDLERS, type CommandDeps } from "../dist/main/ipc/command-handlers.js";

test("jobs.list reflects Main-owned background jobs after a learning job completes", async () => {
  const ctx = createMainContext({ testMode: true });
  const started = ctx.learning.start({ import_source: "chat.txt" });
  await ctx.learning.run(started.job_id);
  const res = await QUERY_HANDLERS["jobs.list"](ctx as unknown as QueryDeps)();
  assert.equal(res.ok, true);
  if (res.ok) {
    const j = res.data.jobs.find((x) => x.job_id === started.job_id);
    assert.ok(j, "job visible via jobs.list");
    assert.equal(j.state, "COMPLETED");
    assert.equal(j.type, "learning");
    assert.equal(j.progress, 100);
  }
});

test("jobs.get returns the job and errors for unknown ids", async () => {
  const ctx = createMainContext({ testMode: true });
  const started = ctx.learning.start({ import_source: "a.txt" });
  await ctx.learning.run(started.job_id);
  const okRes = await QUERY_HANDLERS["jobs.get"](ctx as unknown as QueryDeps)({ job_id: started.job_id });
  assert.equal(okRes.ok, true);
  if (okRes.ok) assert.equal(okRes.data.job_id, started.job_id);
  const errRes = await QUERY_HANDLERS["jobs.get"](ctx as unknown as QueryDeps)({ job_id: "nope" });
  assert.equal(errRes.ok, false);
});

test("jobs.cancel transitions a QUEUED job through CANCELLING to CANCELLED", async () => {
  const ctx = createMainContext({ testMode: true });
  const job = ctx.jobs.create("learning", { import_source: "x.txt" });
  const res = await COMMAND_HANDLERS["jobs.cancel"](ctx as unknown as CommandDeps)({ job_id: job.job_id });
  assert.equal(res.ok, true);
  const after = ctx.jobs.get(job.job_id);
  assert.equal(after?.state, "CANCELLED");
});
