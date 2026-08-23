// M12 clean build (clean-room). typecheck + workspace build + contracts build +
// Electron build + Worker launch + no required developer absolute path.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
let failed = 0;
const results = {};
const check = (n, c, extra = "") => { results[n] = c ? "PASS" : "FAIL"; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };
function run(label, cmd, args) {
  try { execFileSync(cmd, args, { encoding: "utf-8", cwd: ROOT, stdio: "pipe", shell: cmd === "pnpm" }); check(label, true); }
  catch (e) { check(label, false, String(e.stdout ?? e.message ?? "").slice(0, 200)); }
}
run("typecheck", "pnpm", ["run", "typecheck"]);
run("workspace build", "pnpm", ["-r", "run", "build"]);
run("contracts build", "pnpm", ["--filter", "@fastwork/contracts", "run", "build"]);
run("desktop build", "pnpm", ["--filter", "@fastwork/desktop", "run", "build"]);
run("worker launch", "py", ["-3.12", "-m", "compileall", "-q", "services/ai-worker/src"]);

// No hardcoded developer absolute path in required source.
const forbidden = ["C:/Users/13937", "E:\\ai\u5ba2\u670d\u6570\u636e\\FastWork\\rebuild\\packages"];
let pathHits = 0;
for (const base of [join(ROOT, "packages"), join(ROOT, "apps"), join(ROOT, "services")]) {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir, out = []) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(ts|mjs|json)$/.test(e.name)) out.push(p); } return out; };
  for (const f of walk(base)) {
    const c = readFileSync(f, "utf-8");
    if (forbidden.some((t) => c.includes(t))) { pathHits++; console.log("FAIL hardcoded path in " + f); }
  }
}
check(pathHits === 0, "no hardcoded developer absolute path (" + pathHits + ")");

const report = { milestone: "M12", checks: results, hardcoded_dev_path: pathHits, all_passed: failed === 0 };
writeFileSync(join(ROOT, "reports", "m12-build-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 clean build FAILED"); process.exit(1); }
console.log("M12 clean build PASS.");
