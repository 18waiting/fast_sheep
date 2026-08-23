import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";
import { COMMAND_HANDLERS, type CommandDeps } from "../dist/main/ipc/command-handlers.js";
import type { OptimizationWorkerClientPort, ProductRepositoryPort, ProductRow } from "@fastwork/product-optimization";
import type { WorkerJobClientPort } from "@fastwork/background-jobs";

function makeProductRepo(rows: ProductRow[]): ProductRepositoryPort {
  const map = new Map(rows.map((r) => [r.product_id, { ...r }]));
  return {
    get: (id) => map.get(id) ?? null,
    updateDetail: (id, detail, meta) => {
      const p = map.get(id);
      if (!p) return false;
      p.detail = detail;
      if (meta?.lastOptimizedAt) p.last_optimized_at = meta.lastOptimizedAt;
      return true;
    },
  };
}

test("optimization.propose: Worker proposes, Main applies atomically with backup + cooldown", async () => {
  const productRepository = makeProductRepo([{ product_id: "10001", title: "T恤", detail: "旧详情", shop: "pdd", note: "" }]);
  const optimizationWorker: OptimizationWorkerClientPort = {
    propose: async (request) => ({ proposal: { product_id: String(request.product_id), detail: "优化后详情" } }),
  };
  const workerJobClient: WorkerJobClientPort = { run: async () => ({ ok: true }) };
  const ctx = createMainContext({ testMode: true, workerJobClient, optimizationWorkerClient: optimizationWorker, productRepository });
  const res = await COMMAND_HANDLERS["optimization.propose"](ctx as unknown as CommandDeps)({ action: "propose", request: { product_id: "10001" } });
  assert.equal(res.ok, true);
  const jobs = ctx.jobs.list("optimization");
  assert.equal(jobs.length, 1);
  const job = ctx.jobs.get(jobs[0].job_id)!;
  await ctx.optimization.run(job.job_id);
  assert.equal(ctx.jobs.get(job.job_id)!.state, "COMPLETED");
  assert.equal(productRepository.get("10001")!.detail, "优化后详情");
  assert.ok(productRepository.get("10001")!.last_optimized_at, "cooldown metadata written by Main");

  // Second call inside the cooldown window: no mutation.
  const res2 = await COMMAND_HANDLERS["optimization.propose"](ctx as unknown as CommandDeps)({ action: "propose", request: { product_id: "10001" } });
  assert.equal(res2.ok, true);
  if (res2.ok) await ctx.optimization.run(res2.data.job_id);
  const job2 = ctx.jobs.get(res2.data.job_id)!;
  const result = JSON.parse(job2.result ?? "{}");
  assert.equal(result.applied, false);
  assert.equal(result.reason, "cooldown");
});

test("optimization apply failure preserves the original product detail", async () => {
  let fail = true;
  const productRepository: ProductRepositoryPort = {
    get: () => ({ product_id: "10001", title: "T", detail: "原始", shop: "s", note: "" }),
    updateDetail: () => { if (fail) return false; return true; },
  };
  const optimizationWorker: OptimizationWorkerClientPort = { propose: async () => ({ proposal: { product_id: "10001", detail: "新" } }) };
  const ctx = createMainContext({ testMode: true, optimizationWorkerClient: optimizationWorker, productRepository, workerJobClient: { run: async () => ({ ok: true }) } });
  const res = await COMMAND_HANDLERS["optimization.apply"](ctx as unknown as CommandDeps)({ action: "apply", request: { product_id: "10001", proposal: { product_id: "10001", detail: "新" } } });
  assert.equal(res.ok, true);
  if (res.ok) await ctx.optimization.run(res.data.job_id);
  const job = ctx.jobs.get(res.data.job_id)!;
  const result = JSON.parse(job.result ?? "{}");
  assert.equal(result.applied, false);
  assert.equal(result.reason, "update_failed");
  assert.equal(productRepository.get("10001")!.detail, "原始", "original detail preserved on injected failure");
});
