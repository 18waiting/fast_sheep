// PACK-002 packaged-worker smoke implementation (clean-room).
// Launches the packaged fastwork-ai-worker.exe and performs a REAL JSONL RPC v1
// round trip (system.health + rag.rebuild_index + rag.index_status + graceful
// shutdown), verifying stdout is protocol-only and FAISS/NumPy native libs load.
import { spawn } from "node:child_process";
import { openDatabase } from "../packages/persistence/dist/index.js";

const [exePath, dataRoot, schemasDir, label] = process.argv.slice(2);
if (!exePath || !dataRoot || !schemasDir) {
  console.error("usage: node run-packaged-worker-smoke-impl.mjs <exe> <dataRoot> <schemasDir> [label]");
  process.exit(2);
}

// Create a fresh schema-v4 DB in the temp data root (repo tooling only; the
// packaged worker itself does not depend on the repo).
const db = openDatabase(dataRoot);
db.conn.exec("PRAGMA quick_check");
db.conn.close();

// Env WITHOUT PYTHONPATH / PYTHONHOME (self-contained proof).
const env = {};
for (const k of ["PATH", "SYSTEMROOT", "TEMP", "TMP", "WINDIR"]) {
  if (process.env[k] !== undefined) env[k] = process.env[k];
}
env.FASTWORK_DATA_DIR = dataRoot;
env.FASTWORK_CONTRACTS_SCHEMAS_DIR = schemasDir;
env.PYTHONIOENCODING = "utf-8";

const child = spawn(exePath, [], { cwd: dataRoot, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
let stdoutBuf = "";
let stderrText = "";
let exitCode = null;
const lines = [];
const pending = new Map();

child.stdout.on("data", (d) => { stdoutBuf += String(d); });
child.stderr.on("data", (d) => { stderrText += String(d); });
child.on("exit", (code) => { exitCode = code; });

function send(obj) { child.stdin.write(JSON.stringify(obj) + "\n"); }
function waitResp(id) { return new Promise((resolve) => pending.set(id, resolve)); }
function settle(id, val) { const r = pending.get(id); if (r) { pending.delete(id); r(val); } }

function handleLine(raw) {
  let obj = null;
  try { obj = JSON.parse(raw); } catch { /* non-JSONL on stdout -> protocol violation */ }
  lines.push({ raw, obj });
  if (!obj) return;
  if (obj.request_id) settle(obj.request_id, obj);
}

const timer = setInterval(() => {
  let idx;
  while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (line) handleLine(line);
  }
}, 15);
const timeout = setTimeout(() => { console.error("PACK-002 smoke timeout (" + label + ")"); child.kill(); process.exit(1); }, 120000);

const results = [];
const check = (n, c, extra = "") => { results.push({ name: n, ok: c, extra }); console.log((c ? "PASS " : "FAIL ") + "[" + label + "] " + n + (c ? "" : " " + extra)); };
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

try {
  // The ready event has no request_id; wait for any worker.ready line.
  for (let i = 0; i < 200 && !lines.some((l) => l.obj && l.obj.event === "worker.ready"); i++) await new Promise((r) => setTimeout(r, 200));
  check("worker.ready on stdout", lines.some((l) => l.obj && l.obj.event === "worker.ready"));
  await new Promise((r) => setTimeout(r, 500));

  send({ version: 1, request_id: "smoke-health", method: "system.health", payload: {}, context: { shop_id: "", correlation_id: "p2-1" } });
  const health = await withTimeout(waitResp("smoke-health"), 30000);
  check("system.health JSONL response", health && health.ok === true && health.result && health.result.status === "ok", JSON.stringify(health && health.result).slice(0, 120));

  send({ version: 1, request_id: "smoke-rag", method: "rag.rebuild_index", payload: { mode: "full" }, context: { shop_id: "", correlation_id: "p2-2" } });
  const rag = await withTimeout(waitResp("smoke-rag"), 60000);
  check("rag.rebuild_index (FAISS load + index build)", rag && rag.ok === true && rag.result && rag.result.ok === true, JSON.stringify(rag && rag.result).slice(0, 160));

  send({ version: 1, request_id: "smoke-rag-status", method: "rag.index_status", payload: {}, context: { shop_id: "", correlation_id: "p2-3" } });
  const status = await withTimeout(waitResp("smoke-rag-status"), 30000);
  check("rag.index_status ready", status && status.ok === true && status.result && status.result.ready === true, JSON.stringify(status && status.result).slice(0, 120));

  const nonJson = lines.filter((l) => !l.obj);
  check("stdout protocol-only (no non-JSONL lines)", nonJson.length === 0, "nonJson=" + nonJson.length);

  const bad = ["ModuleNotFoundError", "ImportError", "DLL load failed", "Traceback", "No module named"];
  const stderrBad = bad.filter((b) => stderrText.includes(b));
  check("no Python/FAISS/NumPy load error", stderrBad.length === 0, stderrBad.join(","));

  send({ version: 1, request_id: "smoke-shutdown", method: "system.shutdown", payload: {}, context: { shop_id: "", correlation_id: "p2-4" } });
  const sh = await withTimeout(waitResp("smoke-shutdown"), 30000);
  check("system.shutdown response", sh && sh.ok === true && sh.result && sh.result.ok === true, JSON.stringify(sh && sh.result).slice(0, 100));
  // EOF on stdin lets the stdio server's read loop break and exit gracefully.
  child.stdin.end();
  await new Promise((r) => setTimeout(r, 5000));
  check("worker exited cleanly", exitCode === 0, "exitCode=" + exitCode);
} finally {
  clearInterval(timer);
  clearTimeout(timeout);
  if (exitCode === null) child.kill();
}

const failed = results.filter((r) => !r.ok).length;
if (failed > 0) {
  console.error("---- stdout lines ----");
  for (const l of lines.slice(0, 30)) console.error("  " + l.raw.slice(0, 200));
  console.error("---- stderr ----");
  console.error(stderrText.slice(0, 2000));
}
console.log("PACK-002 packaged-worker smoke [" + label + "]: " + (failed === 0 ? "PASS" : "FAIL") + " (exit=" + exitCode + ")");
process.exit(failed === 0 ? 0 : 1);
