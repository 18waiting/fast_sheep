// M10 learning golden execution (clean-room). Discovers GF-LEARN-* on disk and
// executes the real worker implementation via the Python golden runner.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const TESTS = join(ROOT, "services", "ai-worker", "tests");
const FIXTURES = join(ROOT, "..", "parity-tests", "fixtures", "learn");
const REPORT = join(ROOT, "reports", "m10-learning-test-report.json");

const code = [
  "import sys, json",
  "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
  "sys.path.insert(0, " + JSON.stringify(TESTS) + ")",
  "from m10_helpers import " + "run_all_learning_goldens" + "",
  "r = " + "run_all_learning_goldens" + "(" + JSON.stringify(FIXTURES) + ")",
  "print(json.dumps(r))",
].join("\n");
const out = JSON.parse(execFileSync("py", ["-3.12", "-c", code], { encoding: "utf-8", cwd: ROOT }).trim().split(/\r?\n/).pop());
const report = { schema_version: "1.0", milestone: "M10", fixture_family: "LEARN", discovered: out.discovered, executed: out.discovered, passed: out.passed, failed: out.failed, cases: out.results, all_passed: out.failed === 0 };
writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n", "utf-8");
for (const r of out.results) console.log(r.case_id + ": " + r.result);
if (out.failed > 0) { console.error("M10 LEARN goldens FAILED"); process.exit(1); }
console.log("M10 LEARN golden execution PASS (" + out.passed + "/" + out.discovered + ").");
