// M7 no-network check (clean-room). M7 deterministic tests must never make
// external network calls; local fixture loading + Electron IPC + M2 stdio only.
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
  join(ROOT, "packages", "platform-pdd", "src"),
  join(ROOT, "apps", "desktop", "src", "main", "platforms", "pdd"),
  join(ROOT, "apps", "desktop", "src", "platforms", "pdd"),
];
// M7 scripts only (other milestone check scripts legitimately list forbidden tokens).
const m7Scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.startsWith("m7") || f.includes("pdd"));
const forbidden = ["fetch(", "net.connect", "new WebSocket", "WebSocket(", "node:http", "node:https", "node:net", "axios", "got(", "undici"];

for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })) continue;
  for (const f of walk(root)) {
    const content = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      if (content.includes(token)) {
        failures.push(f.slice(ROOT.length + 1) + " contains " + token);
        console.log("FAIL " + f + " contains " + token);
      }
    }
  }
}
for (const f of m7Scripts) {
  const content = readFileSync(join(ROOT, "scripts", f), "utf-8");
  for (const token of forbidden) {
    if (content.includes(token)) {
      failures.push("scripts/" + f + " contains " + token);
      console.log("FAIL scripts/" + f + " contains " + token);
    }
  }
}
check(failures.length === 0, "no external network APIs in M7 code + scripts");
if (failures.length > 0) { console.error(failures.join("; ")); process.exit(1); }
console.log("M7 no-network check PASS.");
