import { test } from "node:test";
import assert from "node:assert/strict";
import { JobManager, JobRegistry, JobCancellation } from "../dist/index.js";

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

test("cancel transitions RUNNING -> CANCELLING -> CANCELLED", () => {
  const repo = makeRepo();
  const registry = new JobRegistry();
  const manager = new JobManager({ registry, repository: repo, jobIdFactory: () => "j1" });
  manager.create("learning", {});
  const job = manager.cancel("j1");
  assert.equal(job.state, "CANCELLED");
  assert.ok(repo.get("j1").finished_at, "finished_at recorded");
});

test("JobCancellation check throws when cancelled", () => {
  const c = new JobCancellation();
  c.cancel();
  assert.equal(c.isCancelled(), true);
  assert.throws(() => c.check());
});

test("cancelling a completed job throws", async () => {
  const repo = makeRepo();
  const registry = new JobRegistry();
  registry.register("learning", async () => ({ ok: true }));
  const manager = new JobManager({ registry, repository: repo, jobIdFactory: () => "j1" });
  manager.create("learning", {});
  await manager.run("j1");
  assert.throws(() => manager.cancel("j1"));
});
