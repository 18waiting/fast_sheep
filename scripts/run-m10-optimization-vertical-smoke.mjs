// M10 optimization vertical smoke (clean-room). Real worker proposes; Main applies
// atomically (guards/cooldown/backup). Cooldown blocks a second call; an injected
// update failure preserves the original product detail.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteJobRepository, SqliteProductRepository } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import { WorkerJobClient } from "../packages/background-jobs/dist/index.js";
import { WorkerOptimizationClient } from "../packages/product-optimization/dist/index.js";
import { BackgroundJobService } from "../apps/desktop/dist/main/services/background-job-service.js";
import { DesktopProductOptimizationService } from "../apps/desktop/dist/main/services/product-optimization-service.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m10-opt-"));
let worker;
let conn;
const report = { scenario: "optimization vertical", worker: "real", first_applied: null, cooldown_blocked: null, failure_preserved: null, all_passed: false };
try {
  ({ conn } = openDatabase(dataRoot));
  const productSqlite = new SqliteProductRepository(conn);
  productSqlite.save({ product_id: "10001", title: "T恤", detail: "原始详情", shop: "pdd-店", note: "" });
  const productRepository = {
    get: (id) => {
      const p = productSqlite.get(id);
      return p ? { product_id: p.product_id, title: p.title, detail: p.detail, shop: p.shop, note: p.note, last_optimized_at: p.last_optimized_at ?? null } : null;
    },
    updateDetail: (id, detail, meta) => productSqlite.updateDetail(id, detail, meta ? { lastOptimizedAt: meta.lastOptimizedAt } : undefined),
  };

  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();

  const jobs = new BackgroundJobService({ jobRepository: new SqliteJobRepository(conn) });
  const service = new DesktopProductOptimizationService({
    jobs,
    workerJobClient: new WorkerJobClient(worker),
    optimizationWorker: new WorkerOptimizationClient(worker),
    productRepository,
  });

  // First propose+apply: worker proposes, Main applies atomically.
  const first = service.action({ action: "propose", request: { product_id: "10001" } });
  await service.run(first.job_id);
  const firstJob = jobs.get(first.job_id);
  const firstResult = JSON.parse(firstJob?.result ?? "{}");
  report.first_applied = firstResult.applied === true;
  check("first optimization applied", firstResult.applied === true, JSON.stringify(firstResult));
  check("product detail updated", productSqlite.get("10001")?.detail.length > 0);
  check("cooldown metadata written", Boolean(productSqlite.get("10001")?.last_optimized_at));

  // Second call inside cooldown: no mutation.
  const second = service.action({ action: "propose", request: { product_id: "10001" } });
  await service.run(second.job_id);
  const secondJob = jobs.get(second.job_id);
  const secondResult = JSON.parse(secondJob?.result ?? "{}");
  report.cooldown_blocked = secondResult.reason === "cooldown";
  check("second call blocked by cooldown", secondResult.reason === "cooldown", JSON.stringify(secondResult));

  // Injected update failure preserves the original (fresh product 10002, no cooldown).
  productSqlite.save({ product_id: "10002", title: "新品", detail: "原始详情2", shop: "pdd-店", note: "" });
  const orig = productSqlite.get("10002")?.detail;
  const failingRepo = {
    get: (id) => productSqlite.get(id) ? { product_id: String(id), title: "新品", detail: productSqlite.get(id)?.detail ?? "", shop: "pdd-店", note: "", last_optimized_at: productSqlite.get(id)?.last_optimized_at ?? null } : null,
    updateDetail: () => false,
  };
  const failService = new DesktopProductOptimizationService({
    jobs,
    workerJobClient: new WorkerJobClient(worker),
    optimizationWorker: new WorkerOptimizationClient(worker),
    productRepository: failingRepo,
  });
  const third = failService.action({ action: "apply", request: { product_id: "10002", proposal: { product_id: "10002", detail: "新详情" } } });
  await failService.run(third.job_id);
  const thirdJob = jobs.get(third.job_id);
  const thirdResult = JSON.parse(thirdJob?.result ?? "{}");
  report.failure_preserved = thirdResult.reason === "update_failed" && productSqlite.get("10002")?.detail === orig;
  check("injected failure preserves original", report.failure_preserved === true, JSON.stringify(thirdResult));

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { conn?.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m10-optimization-effect-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M10 optimization vertical smoke FAILED"); process.exit(1); }
console.log("M10 optimization vertical smoke PASS.");
