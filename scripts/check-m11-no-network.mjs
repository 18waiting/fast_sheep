// M11 no-network check (clean-room). M11 code + scripts must not create external
// network clients; local fixtures + M2 stdio allowed.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (e.endsWith(ext)) out.push(p);
  }
  return out;
}
const roots = [
  join(ROOT, "packages", "legacy-import", "src"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "legacy_import"),
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "rpc", "methods", "legacy_import.py"),
  join(ROOT, "apps", "desktop", "src", "main", "import"),
  join(ROOT, "apps", "desktop", "src", "main", "services"),
];
const forbidden = ["import requests", "import httpx", "urllib.request", "socket.", "http.client", "fetch(", "net.connect", "axios", "new WebSocket", "WebSocket("];
for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })) continue;
  const files = statSync(root).isDirectory() ? walk(root, /\.[jt]s$/.test(root) ? ".ts" : ".py") : [root];
  for (const f of files) {
    const c = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      if (c.includes(token)) { failures.push(f + " contains " + token); console.log("FAIL " + f + " contains " + token); }
    }
  }
}
const m11Scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.includes("m11") && !f.includes("check-m11"));
for (const f of m11Scripts) {
  const c = readFileSync(join(ROOT, "scripts", f), "utf-8");
  for (const token of ["fetch(", "axios", "new WebSocket", "net.connect"]) {
    if (c.includes(token)) { failures.push("scripts/" + f + " contains " + token); console.log("FAIL scripts/" + f + " contains " + token); }
  }
}
const report = { milestone: "M11", external_network_apis: failures.length, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m11-no-network-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
check(failures.length === 0, "no external network APIs in M11 code + scripts");
if (failures.length > 0) process.exit(1);
console.log("M11 no-network check PASS.");
