// Clean-room implementation. M2 (TASK-017): verify M2 reports exist and reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");

function read(name) {
  const p = join(REPORTS, name);
  if (!existsSync(p)) throw new Error("MISSING REPORT: " + name);
  return JSON.parse(readFileSync(p, "utf-8"));
}

const failures = [];
function check(cond, msg) { if (!cond) failures.push(msg); console.log((cond ? "PASS " : "FAIL ") + msg); }

const rpc = read("rpc-test-report.json");
check(rpc.all_passed === true, "rpc-test-report.json all_passed");
check(rpc.typescript.passed === rpc.typescript.tests, "rpc-test-report.json TS " + rpc.typescript.passed + "/" + rpc.typescript.tests);
check(rpc.python.passed === rpc.python.tests, "rpc-test-report.json Python " + rpc.python.passed + "/" + rpc.python.tests);

const parity = read("m2-parity-report.json");
const rpcCases = (parity.cases ?? []).filter((c) => c.case_id.startsWith("GF-RPC-"));
check(rpcCases.length === 12, "m2-parity-report.json has 12 GF-RPC cases");
check(rpcCases.every((c) => c.result === "PASS"), "m2-parity-report.json all 12 GF-RPC PASS");
const sec = (parity.cases ?? []).find((c) => c.case_id === "GF-SEC-007");
check(!!sec && sec.result === "PASS", "m2-parity-report.json GF-SEC-007 PASS");

const lc = read("worker-lifecycle-test-report.json");
check(lc.all_passed === true, "worker-lifecycle-test-report.json all_passed");

const rt = read("m2-python-runtime-report.json");
check(rt.meets_requirement === true, "m2-python-runtime-report.json meets_requirement");

const cr = read("rpc-contract-report.json");
check(cr.all_passed === true, "rpc-contract-report.json all_passed");

if (failures.length > 0) {
  console.error("M2 report verification FAILED: " + failures.join("; "));
  process.exit(1);
}
console.log("M2 reports verified OK.");
