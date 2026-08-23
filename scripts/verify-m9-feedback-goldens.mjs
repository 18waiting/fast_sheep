// M9 feedback golden execution (clean-room). Discovers GF-FB-* and executes the real
// worker KnowledgeFeedbackService (+ Main FeedbackService effect policy semantics).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const TESTS = join(ROOT, "services", "ai-worker", "tests");
const FIXTURES = join(ROOT, "..", "parity-tests", "fixtures", "fb");

const code = [
  "import sys, json",
  "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
  "sys.path.insert(0, " + JSON.stringify(TESTS) + ")",
  "from m9_golden_runner import run_all_feedback_goldens",
  "r = run_all_feedback_goldens(" + JSON.stringify(FIXTURES) + ")",
  "print(json.dumps(r))",
].join("\n");
const out = JSON.parse(execFileSync("py", ["-3.12", "-c", code], { encoding: "utf-8", cwd: ROOT }).trim().split(/\r?\n/).pop());
const report = { schema_version: "1.0", discovered: out.discovered, executed: out.discovered, passed: out.passed, failed: out.failed, cases: out.results, all_passed: out.failed === 0 };
writeFileSync(join(ROOT, "reports", "m9-feedback-test-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
for (const r of out.results) console.log(r.case_id + ": " + r.result);
if (out.failed > 0) { console.error("M9 feedback goldens FAILED"); process.exit(1); }
console.log("M9 feedback golden execution PASS (" + out.passed + "/" + out.discovered + ").");
