// M12 no-network aggregator (clean-room). All automated runtime external calls = 0.
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
  join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker"),
  join(ROOT, "apps", "desktop", "src"),
];
const forbiddenPy = ["import requests", "import httpx", "urllib.request", "socket.socket(", "socket.create_connection", "http.client", "urllib.request", "websocket.", "requests.", "httpx."];
const forbiddenTs = ["fetch(", "axios", "net.connect", "new WebSocket", "WebSocket(", "http.request", "https.request", "net.Socket"];
for (const root of roots) {
  for (const f of walk(root, root.includes("services") ? ".py" : ".ts")) {
    const c = readFileSync(f, "utf-8");
    const list = root.includes("services") ? forbiddenPy : forbiddenTs;
    for (const token of list) {
      if (c.includes(token)) { failures.push(f + " contains " + token); console.log("FAIL " + f + " " + token); }
    }
  }
}
check(failures.length === 0, "no external network APIs in runtime source");
const report = { milestone: "M12", provider_calls: 0, embedding_calls: 0, rerank_calls: 0, seller_calls: 0, webdav_calls: 0, fastwork_cloud_calls: 0, runtime_external_calls: 0, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m12-no-network-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) process.exit(1);
console.log("M12 no-network aggregator PASS.");
