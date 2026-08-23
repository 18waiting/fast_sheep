// M12 clean-room scope check (clean-room). No original FastWork binaries /
// proprietary assets in the distributable source/build.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
// Tokens are constructed so the M0 boundary checker (which scans source for these
// exact literals) does not self-flag this checker.
const forbidden = ["FastWork" + ".exe", "app" + ".asar", "." + "jsc", "recovered" + "/", "ai_bridge" + ".dist"];
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name === "node_modules" || e.name === ".tmp-wd" || e.name === "dist") continue; walk(p, out); }
    else out.push(p);
  }
  return out;
}
let hits = 0;
for (const f of walk(join(ROOT, "packages"))) {
  const low = f.toLowerCase();
  if (forbidden.some((t) => low.includes(t.toLowerCase()))) { hits++; console.log("FAIL forbidden artifact " + f); }
}
for (const f of walk(join(ROOT, "services", "ai-worker", "src"))) {
  if (f.toLowerCase().includes("recovered") || f.endsWith("." + "jsc")) { hits++; console.log("FAIL forbidden artifact " + f); }
}
check(hits === 0, "no original FastWork artifacts in source (" + hits + ")");
const report = { milestone: "M12", forbidden_artifacts: hits, all_passed: hits === 0 };
writeFileSync(join(ROOT, "reports", "m12-clean-room-scope-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (hits > 0) process.exit(1);
console.log("M12 clean-room scope PASS.");
