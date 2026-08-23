// M5 conversation golden executor (TASK-020): discovers GF-CONV-*.json from disk and
// genuinely executes each through the real ConversationEngine (deterministic ports).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");
const TESTS = join(REBUILD, "services", "ai-worker", "tests");
const FIXTURES = join(HERE, "..", "..", "parity-tests", "fixtures", "conv");

function pythonCmd() {
  if (process.env.FASTWORK_PYTHON) return [process.env.FASTWORK_PYTHON, "-c"];
  return ["py", "-3.12", "-c"];
}

const files = readdirSync(FIXTURES).filter((f) => f.startsWith("GF-CONV-") && f.endsWith(".json")).sort();
console.log("Discovered " + files.length + " conversation fixtures from disk.");

const code = [
  "import sys, json",
  "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
  "sys.path.insert(0, " + JSON.stringify(TESTS) + ")",
  "from m5_conversation_helpers import run_all_conversation_goldens",
  "r = run_all_conversation_goldens(" + JSON.stringify(FIXTURES) + ")",
  "print(json.dumps(r))",
].join("\n");

const out = execFileSync(pythonCmd()[0], [...pythonCmd().slice(1), code], { encoding: "utf-8", cwd: REBUILD, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
const result = JSON.parse(out.trim().split(/\r?\n/).pop());

const cases = result.results.map((r) => {
  const fx = JSON.parse(readFileSync(join(FIXTURES, r.case_id + ".json"), "utf-8"));
  return { case_id: r.case_id, behavior_ids: fx.behavior_ids ?? [], test_class: fx.test_class ?? "", parity_level: fx.parity_level ?? "", implemented_test: "verify-m5-conversation-goldens.mjs -> m5_conversation_helpers (real ConversationEngine)", comparison_mode: fx.comparison?.mode ?? "EXECUTED", result: r.result, notes: r.notes ?? "" };
});
writeFileSync(join(REBUILD, "reports", "m5-conversation-fixture-results.json"), JSON.stringify({ schema_version: "1.0", cases }, null, 2) + "\n", "utf-8");
for (const r of result.results) console.log(r.case_id + ": " + r.result + (r.notes ? " (" + r.notes.slice(0, 80) + ")" : ""));
if (result.failed > 0) { console.error("CONVERSATION GOLDEN FAILED: " + result.failed); process.exit(1); }
console.log("PASS: " + result.passed + "/" + result.discovered + " executed; deferred=" + result.deferred.length);
