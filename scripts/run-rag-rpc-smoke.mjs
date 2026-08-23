// M3 real-worker RAG smoke (TASK-018): temp FASTWORK_DATA_DIR, migrate M1 DB,
// insert synthetic knowledge via the worker repository, start the real Python
// worker, rag.rebuild_index -> rag.index_status -> rag.retrieve, assert a
// deterministic result, graceful shutdown, cleanup. No external network.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

function pythonCmd(script) {
  if (process.env.FASTWORK_PYTHON) return [process.env.FASTWORK_PYTHON, "-c", script];
  return ["py", "-3.12", "-c", script];
}

let failed = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) failed += 1;
};

const dataRoot = mkdtempSync(join(tmpdir(), "fw-rag-smoke-"));
try {
  // 1) Initialize/migrate M1 DB via Node persistence (MAIN side).
  const { conn } = openDatabase(dataRoot);
  conn.close();

  // 2) Insert synthetic knowledge through the WORKER-owned repository.
  const seedScript = [
    "import os, sys, json",
    "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
    "from fastwork_ai_worker.persistence import open_worker_db, KnowledgeRepository",
    "conn = open_worker_db(os.environ['FASTWORK_DATA_DIR'])",
    "kr = KnowledgeRepository(conn)",
    "kr.upsert({'id':'k1','question':'这个多少钱','answer':'99元','product_id':'P1','tags':[],'source':'smoke','trust_level':'HUMAN_CONFIRMED','created_at':'2026-08-15T00:00:00Z','updated_at':'2026-08-15T00:00:00Z'})",
    "kr.upsert({'id':'k2','question':'发货多久','answer':'48小时','product_id':'','tags':[],'source':'smoke','trust_level':'HUMAN_CONFIRMED','created_at':'2026-08-15T00:00:01Z','updated_at':'2026-08-15T00:00:01Z'})",
    "conn.commit(); conn.close()",
    "print('seeded')",
  ].join("\n");
  execFileSync(pythonCmd(seedScript)[0], pythonCmd(seedScript).slice(1), {
    encoding: "utf-8",
    cwd: REBUILD,
    env: { ...process.env, FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
  });

  // 3) Start the real Python worker.
  const client = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: REBUILD },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC },
    startupTimeoutMs: 10_000,
    requestTimeoutMs: 15_000,
  });
  await client.start();
  try {
    // 4) rag.rebuild_index
    const rebuild = await client.request("rag.rebuild_index", { mode: "full" });
    check("rag.rebuild_index ok", rebuild.ok === true && rebuild.entry_count === 2);

    // 5) rag.index_status
    const status = await client.request("rag.index_status", {});
    check("rag.index_status ready", status.ready === true && status.dimension === 1024 && status.metric === "INNER_PRODUCT");
    check("rag.index_status counts", status.global_count === 2 && status.common_count === 0);

    // 6) rag.retrieve deterministic
    const res = await client.request("rag.retrieve", { query: "这个多少钱", product_id: "P1" });
    const hitAnswers = (res.hits ?? []).map((h) => h.answer);
    const found = res.fast_return === true || hitAnswers.includes("99元");
    check("rag.retrieve deterministic hit", found);
    if (!found) console.log("  hits=" + JSON.stringify(res.hits));
  } finally {
    // 7) graceful shutdown
    await client.stop();
    check("worker graceful shutdown", client.state() === "STOPPED");
  }
} finally {
  rmSync(dataRoot, { recursive: true, force: true });
}

if (failed > 0) {
  console.error("RAG SMOKE FAILED: " + failed + " check(s)");
  process.exit(1);
}
console.log("RAG SMOKE PASS");
