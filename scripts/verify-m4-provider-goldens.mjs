// M4 prov golden executor (TASK-019): derives fixtures from disk and genuinely
// executes each against the deterministic Python harness (m4_helpers + real subsystem).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");
const TESTS = join(REBUILD, "services", "ai-worker", "tests");
const FIXTURES = join(HERE, "..", "..", "parity-tests", "fixtures", "prov");

function pythonCmd() {
  if (process.env.FASTWORK_PYTHON) return [process.env.FASTWORK_PYTHON, "-c"];
  return ["py", "-3.12", "-c"];
}

const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort();
console.log("Discovered " + files.length + " fixtures from disk (prov).");

const code = [
  "import sys, json",
  "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
  "sys.path.insert(0, " + JSON.stringify(TESTS) + ")",
  "from m4_helpers import run_golden_group",
  "r = run_golden_group(" + "\"prov\"" + ", " + JSON.stringify(FIXTURES) + ")",
  "print(json.dumps(r))",
].join("\n");

const out = execFileSync(pythonCmd()[0], [...pythonCmd().slice(1), code], { encoding: "utf-8", cwd: REBUILD, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
const result = JSON.parse(out.trim().split(/\r?\n/).pop());

const cases = result.results.map((r) => {
  const fx = JSON.parse(readFileSync(join(FIXTURES, r.case_id + ".json"), "utf-8"));
  return {
    case_id: r.case_id,
    behavior_ids: fx.behavior_ids ?? [],
    test_class: fx.test_class ?? "DESIGN_CONFORMANCE",
    parity_level: fx.parity_level ?? "",
    implemented_test: "verify-m4-prov-goldens.mjs -> m4_helpers (real subsystem)",
    comparison_mode: fx.comparison?.mode ?? "EXECUTED",
    result: r.result,
    notes: r.notes ?? "",
  };
});

writeFileSync(join(REBUILD, "reports", "m4-provider-fixture-results.json"), JSON.stringify({ schema_version: "1.0", cases, all_passed: result.failed === 0 }, null, 2) + "\n", "utf-8");
for (const r of result.results) console.log(r.case_id + ": " + r.result);
if (result.failed > 0) {
  console.error("FAILED: " + result.failed + " fixture(s)");
  process.exit(1);
}
console.log("PASS: " + result.passed + "/" + result.discovered + " fixtures executed.");
