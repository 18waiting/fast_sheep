import { test } from "node:test";
import assert from "node:assert/strict";
import { JobManager, JobRegistry, FakeClock, RecordingJobEventBus } from "../dist/index.js";

interface MiniRepo {
  rows: Map<string, any>;
  create(j: any): void;
  update(j: any): void;
  get(id: string): any | null;
  list(type?: string, limit?: number): any[];
  listByState(state: string): any[];
}

function makeRepo(): MiniRepo {
  const rows = new Map<string, any>();
  return {
    rows,
    create: (j) => rows.set(j.job_id, { ...j }),
    update: (j) => rows.set(j.job_id, { ...j }),
    get: (id) => rows.get(id) ?? null,
    list: () => [...rows.values()],
    listByState: (state) => [...rows.values()].filter((j) => j.state === state),
  };
}

test("job transitions QUEUED -> RUNNING -> COMPLETED with monotonic progress", async () => {
  const repo = makeRepo();
  const registry = new JobRegistry();
  registry.register("learning", async (ctx) => {
    ctx.report(10, "started");
    ctx.report(20, "step2");
    ctx.report(20, "dup");
    ctx.report(30, "done");
    return { ok: true };
  });
  const clock = new FakeClock(1000);
  const bus = new RecordingJobEventBus();
  const manager = new JobManager({ registry, repository: repo, clock, eventBus: bus, jobIdFactory: () => "j1" });
  const job = manager.create("learning", {});
  assert.equal(job.state, "QUEUED");
  const done = await manager.run("j1");
  assert.equal(done.state, "COMPLETED");
  assert.equal(done.progress, 30);
  assert.ok(bus.events.some((e) => e.event === "JobStateChanged" && (e.payload as any).state === "COMPLETED"));
});

test("job RUNNING -> FAILED records error", async () => {
  const repo = makeRepo();
  const registry = new JobRegistry();
  registry.register("learning", async () => { throw new Error("boom"); });
  const manager = new JobManager({ registry, repository: repo, jobIdFactory: () => "j1" });
  manager.create("learning", {});
  const done = await manager.run("j1");
  assert.equal(done.state, "FAILED");
  assert.ok(String(done.error).includes("boom"));
});
