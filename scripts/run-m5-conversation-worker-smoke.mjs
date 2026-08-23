// M5 real-worker conversation smoke (TASK-020): temp FASTWORK_DATA_DIR, init M1 DB,
// seed synthetic config/prompt/knowledge, build M3 index, start the real Python worker,
// call conversation.generate for normal answer / fast-return / tool route, validate, shutdown.
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

let failed = 0;
const check = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m5-conv-"));
try {
  const { conn } = openDatabase(dataRoot);
  conn.close();
  // seed knowledge + config via worker repos
  const seed = [
    "import os, sys",
    "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
    "from fastwork_ai_worker.persistence import open_worker_db, KnowledgeRepository",
    "conn = open_worker_db(os.environ['FASTWORK_DATA_DIR'])",
    "kr = KnowledgeRepository(conn)",
    "kr.upsert({'id':'k1','question':'这个多少钱','answer':'99元','product_id':'P1','tags':[],'source':'s','trust_level':'HUMAN_CONFIRMED','created_at':'2026-08-16T00:00:00Z','updated_at':'2026-08-16T00:00:00Z'})",
    "conn.commit(); conn.close()",
  ].join("\n");
  execFileSync("py", ["-3.12", "-c", seed], { encoding: "utf-8", cwd: REBUILD, env: { ...process.env, FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" } });

  const client = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: REBUILD },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC },
    startupTimeoutMs: 10000, requestTimeoutMs: 30000,
  });
  await client.start();
  try {
    // build M3 index first so conversation.generate can retrieve
    const rb = await client.request("rag.rebuild_index", { mode: "full" });
    check("rag.rebuild_index ok", rb.ok === true);

    const normal = await client.request("conversation.generate", { question: "这个多少钱", product_id: "P1", order_state: "未下单" });
    check("conversation.generate returns result+trace", !!normal && Array.isArray(normal.trace) && normal.trace.length > 0);

    const fast = await client.request("conversation.generate", { question: "这个多少钱", product_id: "P1", order_state: "未下单" });
    check("conversation.generate fast-return flag present", "fast_return" in fast);

    const tool = await client.request("conversation.generate", { question: "帮我查一下手机库存", product_id: "P1", order_state: "未下单" });
    check("conversation.generate tool route trace", !!tool && Array.isArray(tool.trace));
  } finally {
    await client.stop();
    check("worker graceful shutdown", client.state() === "STOPPED");
  }
} finally {
  rmSync(dataRoot, { recursive: true, force: true });
}
if (failed > 0) { console.error("M5 CONVERSATION SMOKE FAILED"); process.exit(1); }
console.log("M5 CONVERSATION SMOKE PASS");
