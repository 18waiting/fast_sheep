// M10 optimization golden execution (clean-room). Discovers GF-OPT-* on disk and
// executes the real worker implementation via the Python golden runner.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const TESTS = join(ROOT, "services", "ai-worker", "tests");
const FIXTURES = join(ROOT, "..", "parity-tests", "fixtures", "opt");
const REPORT = join(ROOT, "reports", "m10-optimization-test-report.json");

const code = [
  "import sys, json",
  "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
  "sys.path.insert(0, " + JSON.stringify(TESTS) + ")",
  "from m10_helpers import " + "run_all_optimization_goldens" + "",
  "r = " + "run_all_optimization_goldens" + "(" + JSON.stringify(FIXTURES) + ")",
  "print(json.dumps(r))",
].join("\n");
const out = JSON.parse(execFileSync("py", ["-3.12", "-c", code], { encoding: "utf-8", cwd: ROOT }).trim().split(/\r?\n/).pop());
const report = { schema_version: "1.0", milestone: "M10", fixture_family: "OPT", discovered: out.discovered, executed: out.discovered, passed: out.passed, failed: out.failed, cases: out.results, all_passed: out.failed === 0 };
writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n", "utf-8");
for (const r of out.results) console.log(r.case_id + ": " + r.result);
if (out.failed > 0) { console.error("M10 OPT goldens FAILED"); process.exit(1); }

// Main-side parity: the TypeScript CooldownPolicy / BackupPolicy / guardDetail
// must satisfy the same frozen OPT fixtures (cooldown 007-010, backup 011, guards 002-006).
import { CooldownPolicy, BackupPolicy, guardDetail } from "../packages/product-optimization/dist/index.js";

let tsFailed = 0;
const tsCheck = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) tsFailed += 1; };

const BASE = Date.parse("2026-08-15T00:00:00Z");
const cooldown = new CooldownPolicy(3600, 86400);
tsCheck("OPT-007 cooldown false when never optimized", !cooldown.isCoolingDown(null, BASE).cooldown);
tsCheck("OPT-008 cooldown true below 3600s", cooldown.isCoolingDown(new Date(BASE).toISOString(), BASE + 3599 * 1000).cooldown === true);
const cd009 = cooldown.isCoolingDown(new Date(BASE).toISOString(), BASE + 3600 * 1000);
tsCheck("OPT-009 gte boundary not cooling", cd009.cooldown === false && cd009.operator === "gte");
const cd010 = cooldown.isCoolingDown(new Date(BASE).toISOString(), BASE + 172800 * 1000);
tsCheck("OPT-010 stale > 86400 purge", cd010.purge === true);
const backup = new BackupPolicy(() => 0);
tsCheck("OPT-011 backup dir", backup.dir() === "备份/商品库合集/<ts>/");
tsCheck("OPT-002 empty reject", guardDetail("").reason === "empty");
tsCheck("OPT-003 length exactly 20000 allowed", guardDetail("x".repeat(20000)).dirty === false);
tsCheck("OPT-004 length over limit", guardDetail("x".repeat(20001)).reason === "length");
tsCheck("OPT-005 html reject", guardDetail("<div>垃圾</div>").reason === "html");
tsCheck("OPT-006 tailwind reject", guardDetail('class="--tw-" content').reason === "tailwind");

if (tsFailed > 0) { console.error("M10 OPT TS parity FAILED"); process.exit(1); }
console.log("M10 OPT golden execution PASS (" + out.passed + "/" + out.discovered + ") + TS parity PASS.");
