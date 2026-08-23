// M3 no-network check (TASK-018): assert RAG modules create no HTTP clients,
// requests/aiohttp sessions, fetch calls, or socket listeners. Mock providers only.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const RAG_SRC = join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "rag");
const RAG_RPC = join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "rag.py");

const NETWORK_MARKERS = [
  "import requests",
  "from requests",
  "aiohttp",
  "urllib.request",
  "httpx",
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "socket.socket",
  "socket.bind",
  "start_server",
  "createServer",
  "requests.post",
  "requests.get",
  "requests.Session",
];

function walk(p, out) {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isFile()) {
    if ([".py", ".ts", ".mjs", ".js"].includes(extname(p))) out.push(p);
    return;
  }
  for (const e of readdirSync(p)) {
    const child = join(p, e);
    const st2 = statSync(child, { throwIfNoEntry: false });
    if (!st2) continue;
    if (st2.isDirectory()) walk(child, out);
    else if ([".py", ".ts", ".mjs", ".js"].includes(extname(child))) out.push(child);
  }
}

const files = [];
walk(RAG_SRC, files);
if (statSync(RAG_RPC, { throwIfNoEntry: false })) files.push(RAG_RPC);

const findings = [];
for (const f of files) {
  const text = readFileSync(f, "utf-8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const marker of NETWORK_MARKERS) {
      if (line.includes(marker)) {
        findings.push(f.replace(REBUILD + "\\", "").replace(/\\/g, "/") + ":" + (i + 1) + " -> " + line.trim());
      }
    }
  });
}

if (findings.length > 0) {
  console.error("NETWORK MARKERS FOUND IN RAG MODULES:");
  for (const f of findings) console.error("  " + f);
  console.error("NO-NETWORK CHECK FAIL");
  process.exit(1);
}
console.log("No-network check PASS: RAG modules create no HTTP clients / sessions / fetch / socket listeners.");
