import { test } from "node:test";
import assert from "node:assert/strict";
import { recoverJob, recoverAll } from "../dist/index.js";

function makeRepo(rows: any[]) {
  const map = new Map(rows.map((r) => [r.job_id, { ...r }]));
  return {
    create: () => {},
    update: (j: any) => map.set(j.job_id, { ...j }),
    get: (id: string) => map.get(id) ?? null,
    list: () => [...map.values()],
    listByState: (state: string) => [...map.values()].filter((j) => j.state === state),
  };
}

test("RUNNING non-idempotent job is NOT auto-replayed", () => {
  const job = { job_id: "j1", type: "learning", state: "RUNNING", progress: 10, message: "" };
  const d = recoverJob(job);
  assert.equal(d.automatic_replay, false);
  assert.equal(d.duplicate_mutation, false);
  assert.equal(d.state, "FAILED");
});

test("idempotent job may be replayed", () => {
  const job = { job_id: "j2", type: "learning", state: "RUNNING", progress: 10, message: "", result: JSON.stringify({ idempotent: true }) };
  const d = recoverJob(job);
  assert.equal(d.automatic_replay, true);
  assert.equal(d.state, "QUEUED");
});

test("recoverAll marks interrupted non-idempotent jobs FAILED without duplicate mutation", () => {
  const repo = makeRepo([
    { job_id: "a", type: "learning", state: "RUNNING", progress: 5, message: "" },
    { job_id: "b", type: "review", state: "CANCELLING", progress: 5, message: "" },
  ]);
  const ds = recoverAll(repo);
  assert.equal(ds.length, 2);
  assert.ok(ds.every((d) => d.duplicate_mutation === false));
  assert.ok(ds.every((d) => d.automatic_replay === false));
});
