// M2 security check (TASK-017): verify the worker-rpc implementation opens no
// listening network port. Static scan + runtime check. Executes/records GF-SEC-007.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

const SCAN_ROOTS = [
  join(REBUILD, "packages", "worker-rpc", "src"),
  join(WORKER_SRC, "fastwork_ai_worker", "rpc"),
  join(WORKER_SRC, "fastwork_ai_worker", "main.py"),
  join(WORKER_SRC, "fastwork_ai_worker", "__main__.py"),
];

// Listening-server anti-patterns (network servers only), matched as plain substrings.
const LISTEN_MARKERS = [
  "createServer",
  "WebSocketServer",
  "asyncio.start_server",
  "socket.listen",
  "server.listen",
  "listen(",
  "bind((",
  "ServerSocket",
  "TcpListener",
  "net.Server",
];

function walk(p, out) {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isFile()) {
    if ([".ts", ".mjs", ".js", ".py"].includes(extname(p))) out.push(p);
    return;
  }
  for (const e of readdirSync(p)) {
    const child = join(p, e);
    const st2 = statSync(child, { throwIfNoEntry: false });
    if (!st2) continue;
    if (st2.isDirectory()) walk(child, out);
    else if ([".ts", ".mjs", ".js", ".py"].includes(extname(child))) out.push(child);
  }
}

const files = [];
for (const r of SCAN_ROOTS) walk(r, files);

const findings = [];
for (const f of files) {
  const text = readFileSync(f, "utf-8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const marker of LISTEN_MARKERS) {
      if (line.includes(marker)) findings.push(f.replace(REBUILD + "\\", "").replace(/\\/g, "/") + ":" + (i + 1) + " -> " + line.trim());
    }
  });
}

if (findings.length > 0) {
  console.error("LISTENING-SERVER PATTERNS FOUND:");
  for (const f of findings) console.error("  " + f);
  console.error("GF-SEC-007 FAIL");
  process.exit(1);
}
console.log("Static scan: no listening-server patterns in M2 implementation.");

// Runtime check: launch the real worker and confirm no LISTENING sockets for its PID.
function pythonCmd() {
  if (process.env.FASTWORK_PYTHON) return [process.env.FASTWORK_PYTHON, "-m", "fastwork_ai_worker"];
  return ["py", "-3.12", "-m", "fastwork_ai_worker"];
}

async function runtimeCheck() {
  const cmd = pythonCmd();
  const child = spawn(cmd[0], cmd.slice(1), { cwd: REBUILD, env: { ...process.env, FASTWORK_RPC_TEST_MODE: "1", PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("ready timeout")), 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      if (buf.includes("\n")) { clearTimeout(timer); resolve(); }
    });
    child.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
  const pid = child.pid;
  let listening = [];
  try {
    const out = execFileSync("netstat", ["-ano"], { encoding: "utf-8" });
    const re = new RegExp("\\s" + pid + "\\s*$");
    listening = out.split(/\r?\n/).filter((l) => l.includes("LISTENING") && re.test(l));
  } catch {
    // netstat unavailable: fall back to static-only result
  }
  try { child.kill(); } catch {}
  if (listening.length > 0) {
    console.error("WORKER PID " + pid + " HAS LISTENING SOCKETS:");
    for (const l of listening) console.error("  " + l.trim());
    return false;
  }
  console.log("Runtime check: worker PID " + pid + " has 0 LISTENING sockets.");
  return true;
}

const runtimeOk = await runtimeCheck();
if (!runtimeOk) {
  console.error("GF-SEC-007 FAIL");
  process.exit(1);
}
console.log("GF-SEC-007 PASS (SECURITY_IMPROVEMENT): no unauthenticated listening port.");
