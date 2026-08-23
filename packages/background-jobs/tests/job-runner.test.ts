import { test } from "node:test";
import assert from "node:assert/strict";
import { JobManager, JobRegistry } from "../dist/index.js";

function makeRepo() {
  const rows = new Map<string, any>();
  return {
    create: (j: any) => rows.set(j.job_id, { ...j }),
    update: (j: any) => rows.set(j.job_id, { ...j }),
    get: (id: string) => rows.get(id) ?? null,
    list: () => [...rows.values()],
    listByState: (state: string) => [...rows.values()].filter((j) => j.state === state),
  };
}

test("runner receives a JobRunContext with jobId/type/report", async () => {
  const repo = makeRepo();
  const registry = new JobRegistry();
  let seen: any = null;
  registry.register("review", async (ctx) => {
    seen = { jobId: ctx.jobId, type: ctx.type };
    ctx.report(50, "half");
    return { ok: true };
  });
  const manager = new JobManager({ registry, repository: repo, jobIdFactory: () => "j1" });
  manager.create("review", {});
  await manager.run("j1");
  assert.deepEqual(seen, { jobId: "j1", type: "review" });
  assert.equal(repo.get("j1").progress, 50);
});
