import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";
import { COMMAND_HANDLERS, type CommandDeps } from "../dist/main/ipc/command-handlers.js";
import type { WorkerJobClientPort } from "@fastwork/background-jobs";

test("audit.decide routes 保留/丢弃/待定 to the Worker and completes the job", async () => {
  const calls: string[] = [];
  const workerJobClient: WorkerJobClientPort = {
    run: async (type, request) => { calls.push(type + ":" + JSON.stringify(request)); return { ok: true }; },
  };
  const ctx = createMainContext({ testMode: true, workerJobClient });
  const jobIds: string[] = [];
  for (const action of ["保留", "丢弃", "待定"] as const) {
    const res = await COMMAND_HANDLERS["audit.decide"](ctx as unknown as CommandDeps)({ action, entry: { 问题: "q", 答案: "a" } });
    assert.equal(res.ok, true);
    if (res.ok) jobIds.push(res.data.job_id);
  }
  for (const jid of jobIds) await ctx.audit.run(jid);
  assert.equal(calls.length, 3);
  for (const c of calls) assert.ok(c.startsWith("audit.decide:"));
  const payload = JSON.parse(calls[0].slice("audit.decide:".length));
  assert.equal(payload.action, "保留");
  for (const jid of jobIds) assert.equal(ctx.jobs.get(jid)!.state, "COMPLETED");
});

test("audit jobs never write candidates from Main (Node side writes zero candidates)", async () => {
  const workerJobClient: WorkerJobClientPort = { run: async () => ({ ok: true }) };
  const ctx = createMainContext({ testMode: true, workerJobClient });
  const res = await COMMAND_HANDLERS["audit.decide"](ctx as unknown as CommandDeps)({ action: "丢弃", entry: { 问题: "q" } });
  assert.equal(res.ok, true);
  if (res.ok) await ctx.audit.run(res.data.job_id);
  const src = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const file = src.readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "main", "services", "audit-service.ts"), "utf-8");
  for (const token of ["knowledge_candidates", "knowledge_entries", "INSERT INTO", "pending_knowledge"]) {
    assert.ok(!file.includes(token), "audit-service must not write " + token);
  }
});
