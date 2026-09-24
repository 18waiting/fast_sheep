// M8 no-network check (clean-room). New M8 source/test automation must not make
// external network clients; local fixture loading + M2 stdio allowed.
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
    else if (/\.(ts|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

const roots = [
  join(ROOT, "packages", "platform-web-common", "src"),
  ...["doudian", "jd", "kuaishou", "qianniu", "xianyu"].map((p) => join(ROOT, "packages", "platform-" + p, "src")),
  join(ROOT, "apps", "desktop", "src", "main", "platforms"),
  join(ROOT, "apps", "desktop", "src", "platform-preloads"),
];
const forbidden = ["fetch(", "net.connect", "new WebSocket", "WebSocket(", "node:http", "node:https", "node:net", "axios", "got(", "undici"];
for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })) continue;
  for (const f of walk(root)) {
    const content = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      if (content.includes(token)) { failures.push(f.slice(ROOT.length + 1) + " contains " + token); console.log("FAIL " + f + " contains " + token); }
    }
  }
}
const m8Scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.includes("m8") && f !== "check-m8-no-network.mjs");
for (const f of m8Scripts) {
  const content = readFileSync(join(ROOT, "scripts", f), "utf-8");
  for (const token of forbidden) {
    if (content.includes(token)) { failures.push("scripts/" + f + " contains " + token); console.log("FAIL scripts/" + f + " contains " + token); }
  }
}
check(failures.length === 0, "no external network APIs in M8 code + scripts");
if (failures.length > 0) process.exit(1);
console.log("M8 no-network check PASS.");
