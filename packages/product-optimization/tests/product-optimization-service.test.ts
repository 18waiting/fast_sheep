import { test } from "node:test";
import assert from "node:assert/strict";
import { ProductOptimizationService, type ProductRepositoryPort, type OptimizationWorkerClientPort } from "../dist/index.js";

function makeRepo(initial?: { lastOptimizedAt?: string | null }): ProductRepositoryPort & { rows: Map<string, any> } {
  const rows = new Map<string, any>();
  rows.set("10001", { product_id: "10001", title: "T", detail: "旧", shop: "s", note: "", last_optimized_at: initial?.lastOptimizedAt ?? null });
  return {
    rows,
    get: (id) => rows.get(id) ?? null,
    updateDetail: (id, detail, meta) => {
      const p = rows.get(id);
      if (!p) return false;
      p.detail = detail;
      if (meta?.lastOptimizedAt) p.last_optimized_at = meta.lastOptimizedAt;
      return true;
    },
  };
}

test("propose fetches worker proposal; apply guards/cooldowns/backups and atomically updates", async () => {
  const repo = makeRepo();
  const worker: OptimizationWorkerClientPort = { propose: async () => ({ proposal: { product_id: "10001", detail: "<优化后详情>" } }) };
  const svc = new ProductOptimizationService({ repository: repo, workerClient: worker });
  const proposal = await svc.propose("10001");
  assert.equal(proposal.detail, "<优化后详情>");
  const res = await svc.apply(proposal);
  assert.equal(res.applied, true);
  assert.ok(res.backup_id, "backup id produced");
  assert.equal(repo.rows.get("10001").detail, "<优化后详情>");
  assert.ok(repo.rows.get("10001").last_optimized_at, "cooldown metadata written");
});

test("second apply inside cooldown is rejected without mutation", async () => {
  const repo = makeRepo();
  const worker: OptimizationWorkerClientPort = { propose: async () => ({ proposal: { product_id: "10001", detail: "新" } }) };
  const svc = new ProductOptimizationService({ repository: repo, workerClient: worker, cooldownSeconds: 3600 });
  const p1 = await svc.propose("10001");
  await svc.apply(p1);
  const before = repo.rows.get("10001").detail;
  const p2 = await svc.propose("10001");
  const res2 = await svc.apply(p2);
  assert.equal(res2.applied, false);
  assert.equal(res2.reason, "cooldown");
  assert.equal(repo.rows.get("10001").detail, before, "no mutation inside cooldown");
});

test("update failure preserves the original detail", async () => {
  let fail = true;
  const repo = makeRepo();
  repo.updateDetail = () => { if (fail) return false; return true; };
  const worker: OptimizationWorkerClientPort = { propose: async () => ({ proposal: { product_id: "10001", detail: "新" } }) };
  const svc = new ProductOptimizationService({ repository: repo, workerClient: worker });
  const proposal = await svc.propose("10001");
  const res = await svc.apply(proposal);
  assert.equal(res.applied, false);
  assert.equal(res.reason, "update_failed");
  assert.equal(repo.rows.get("10001").detail, "旧", "original preserved");
});
