// M4 real-worker smoke (TASK-019): start the real Python worker in TEST MODE, run
// deterministic test.prompt_assemble / test.provider_route / test.agent_run, assert,
// graceful shutdown. No network.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

const client = new AIWorkerClient({
  spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: REBUILD },
  env: { FASTWORK_RPC_TEST_MODE: "1", PYTHONPATH: WORKER_SRC },
  startupTimeoutMs: 10_000,
  requestTimeoutMs: 15_000,
});

let failed = 0;
const check = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) failed += 1; };

await client.start();
try {
  const pa = await client.request("test.prompt_assemble", { profile_id: "default", order_state: "未下单" });
  check("test.prompt_assemble returns prompt", !!pa && !!pa.prompt && Array.isArray(pa.slots));

  const pr = await client.request("test.provider_route", { mode: "快答专家", daily_count: 5000, points: 100 });
  check("test.provider_route returns provider", !!pr && !!pr.provider);

  const ar = await client.request("test.agent_run", {
    messages: [{ role: "user", content: "hi" }],
    skills: [],
    max_rounds: 2,
  });
  check("test.agent_run returns rounds+text", !!ar && typeof ar.rounds === "number" && typeof ar.text === "string");

  const ep = await client.request("engine.prepare", { query: "hi", mode: "快答专家", daily_count: 1000, points: 10 });
  check("engine.prepare returns prompt+route", !!ep && !!ep.prompt && !!ep.route);
} finally {
  await client.stop();
  check("worker graceful shutdown", client.state() === "STOPPED");
}
if (failed > 0) { console.error("M4 SMOKE FAILED"); process.exit(1); }
console.log("M4 SMOKE PASS");
