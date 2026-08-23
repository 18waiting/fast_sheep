import { test } from "node:test";
import assert from "node:assert/strict";
import { PersistenceJobRepository } from "../dist/index.js";

function makePersistenceRepo() {
  const rows = new Map<string, any>();
  return {
    create: (j: any) => rows.set(j.job_id, { ...j }),
    update: (j: any) => rows.set(j.job_id, { ...j }),
    get: (id: string) => rows.get(id),
    list: (type?: string) => [...rows.values()].filter((j) => !type || j.type === type),
    listByState: (state: string) => [...rows.values()].filter((j) => j.state === state),
  };
}

test("adapter delegates to the persistence JobRepository and maps null", () => {
  const inner = makePersistenceRepo();
  const repo = new PersistenceJobRepository(inner);
  const job = { job_id: "j1", type: "learning", state: "QUEUED", progress: 0, message: "" };
  repo.create(job);
  assert.equal(repo.get("j1")?.job_id, "j1");
  assert.equal(repo.get("nope"), null);
  repo.update({ ...job, state: "RUNNING" });
  assert.equal(repo.get("j1")!.state, "RUNNING");
  assert.equal(repo.listByState("RUNNING").length, 1);
  assert.equal(repo.list("learning").length, 1);
});
