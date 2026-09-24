// M10 no-network check (clean-room). M10 code + scripts must not create external
// network clients; local fixtures + M2 stdio allowed.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "learning"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "review"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "audit"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "optimization"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "m10_domain.py"),
  join(ROOT, "packages", "background-jobs", "src"),
  join(ROOT, "packages", "product-optimization", "src"),
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
const m10Scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.includes("m10") && f !== "check-m10-no-network.mjs");
for (const f of m10Scripts) {
  const content = readFileSync(join(ROOT, "scripts", f), "utf-8");
  for (const token of ["fetch(", "axios", "new WebSocket", "net.connect"]) {
    if (content.includes(token)) { failures.push("scripts/" + f + " contains " + token); console.log("FAIL scripts/" + f + " contains " + token); }
  }
}
const report = { milestone: "M10", external_network_apis: failures, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m10-no-network-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
check(failures.length === 0, "no external network APIs in M10 code + scripts");
if (failures.length > 0) process.exit(1);
console.log("M10 no-network check PASS.");
