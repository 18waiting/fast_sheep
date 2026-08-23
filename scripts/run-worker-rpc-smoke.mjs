// M2 smoke test (TASK-017): launch the real Python worker over stdio JSONL,
// wait for ready, call system.health + test.echo (test mode), graceful shutdown, assert exit.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

function pythonCmd() {
  if (process.env.FASTWORK_PYTHON) return [process.env.FASTWORK_PYTHON, "-m", "fastwork_ai_worker"];
  return ["py", "-3.12", "-m", "fastwork_ai_worker"];
}

const client = new AIWorkerClient({
  spawn: {
    executable: pythonCmd()[0],
    args: pythonCmd().slice(1),
    cwd: REBUILD,
  },
  env: { FASTWORK_RPC_TEST_MODE: "1", PYTHONPATH: WORKER_SRC },
  startupTimeoutMs: 10_000,
  requestTimeoutMs: 5_000,
  gracefulShutdownTimeoutMs: 5_000,
});

let failed = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) failed += 1;
};

await client.start();
check("ready handshake (state READY)", client.state() === "READY");

const health = await client.health();
check("system.health returns ok", health.status === "ok" && health.protocol_version === 1);

const echo = await client.request("test.echo", { text: "smoke" });
check("test.echo returns payload", JSON.stringify(echo) === JSON.stringify({ text: "smoke" }));

const ping = await client.request("ping", {});
check("ping returns ok", ping.ok === true);

await client.stop();
check("graceful shutdown ends STOPPED", client.state() === "STOPPED");

if (failed > 0) {
  console.error("SMOKE FAILED: " + failed + " check(s)");
  process.exit(1);
}
console.log("SMOKE PASS");
