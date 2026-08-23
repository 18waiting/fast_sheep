// M4 no-network check (TASK-019): assert prompt/tool/provider modules create no network
// clients (requests/httpx/aiohttp/urllib network/fetch/axios/socket connect/websocket).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const ROOTS = [
  join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "prompt"),
  join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "tools"),
  join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "providers"),
  join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "m4_engine.py"),
  join(REBUILD, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "m4_test_only.py"),
];

const MARKERS = [
  "import requests", "from requests", "aiohttp", "urllib.request", "urllib.urlopen", "httpx",
  "fetch(", "axios", "XMLHttpRequest", "WebSocket", "socket.socket", "socket.create_connection",
  "connect((", "start_server", "createServer", "requests.post", "requests.get", "requests.Session", "http.client",
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
for (const r of ROOTS) walk(r, files);
const findings = [];
for (const f of files) {
  const text = readFileSync(f, "utf-8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const stripped = line.trim();
    if (stripped.startsWith("#") || stripped.startsWith("//") || stripped.startsWith("*")) return;
    for (const marker of MARKERS) {
      if (line.includes(marker)) findings.push(f.replace(REBUILD + "\\", "").replace(/\\/g, "/") + ":" + (i + 1) + " -> " + line.trim());
    }
  });
}
if (findings.length > 0) {
  console.error("NETWORK MARKERS FOUND IN M4 MODULES:");
  for (const f of findings) console.error("  " + f);
  console.error("M4 NO-NETWORK CHECK FAIL");
  process.exit(1);
}
console.log("M4 no-network check PASS: no network client creation in prompt/tool/provider modules.");
