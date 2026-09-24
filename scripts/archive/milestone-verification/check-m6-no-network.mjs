// M6 no-network check (clean-room). Desktop + desktop-ipc must never perform
// external network calls. Local Electron file loading and M2 stdio child
// processes are allowed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "PASS " : "FAIL ") + msg); };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

const roots = [
  join(ROOT, "apps", "desktop", "src"),
  join(ROOT, "packages", "desktop-ipc", "src"),
];

const forbidden = [
  "fetch(", "net.connect", "new WebSocket", "WebSocket(", "node:http", "node:https", "node:net",
  "axios", "got(", "undici", "https://", "http://",
];

for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })) continue;
  for (const f of walk(root)) {
    const content = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      if (content.includes(token)) {
        failures.push(`${f.slice(ROOT.length + 1).replace(/\\/g, "/")} contains ${token}`);
        console.log("FAIL " + f + " contains " + token);
      }
    }
  }
}
// The M6 smoke script must not itself make network calls (only spawns Electron).
const smokeSrc = readFileSync(join(ROOT, "scripts", "run-m6-electron-smoke.mjs"), "utf-8");
for (const token of ["fetch(", "net.connect", "new WebSocket", "node:http", "node:https", "axios", "got(", "undici"]) {
  if (smokeSrc.includes(token)) failures.push("scripts/run-m6-electron-smoke.mjs contains " + token);
}
check(failures.length === 0, "no network APIs in smoke script");

check(failures.length === 0, "no external network APIs in desktop + M6 scripts");
if (failures.length > 0) {
  console.error(failures.join("; "));
  console.error("M6 no-network check FAILED.");
  process.exit(1);
}
console.log("M6 no-network check PASS.");
