// M9 no-network check (clean-room). M9 source/test automation must not create
// external network clients; local fixtures + M2 stdio allowed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(py|ts|mjs)$/.test(e)) out.push(p);
  }
  return out;
}
const roots = [
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "handoff"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "feedback"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "handoff.py"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "feedback.py"),
  join(ROOT, "packages", "feedback", "src"),
];
const forbidden = ["import requests", "import httpx", "urllib.request", "socket.", "http.client", "fetch(", "net.connect", "axios", "new WebSocket", "WebSocket("];
for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })) continue;
  const files = statSync(root).isDirectory() ? walk(root) : [root];
  for (const f of files) {
    const content = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      if (content.includes(token)) { failures.push(f.slice(ROOT.length + 1) + " contains " + token); console.log("FAIL " + f + " contains " + token); }
    }
  }
}
const m9Scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.includes("m9") && f !== "check-m9-no-network.mjs");
for (const f of m9Scripts) {
  const content = readFileSync(join(ROOT, "scripts", f), "utf-8");
  for (const token of ["fetch(", "axios", "new WebSocket", "net.connect"]) {
    if (content.includes(token)) { failures.push("scripts/" + f + " contains " + token); console.log("FAIL scripts/" + f + " contains " + token); }
  }
}
check(failures.length === 0, "no external network APIs in M9 code + scripts");
if (failures.length > 0) process.exit(1);
console.log("M9 no-network check PASS.");
