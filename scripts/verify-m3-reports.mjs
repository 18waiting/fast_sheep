// Clean-room implementation. M3 (TASK-018): verify M3 reports reflect passing results.
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

const rt = read("rag-test-report.json");
check(rt.all_passed === true, "rag-test-report.json all_passed");
check(rt.python.passed === rt.python.tests, "rag-test-report.json Python " + rt.python.passed + "/" + rt.python.tests);

const parity = read("m3-parity-report.json");
check(parity.all_passed === true, "m3-parity-report.json all_passed");
const ragCases = (parity.cases ?? []).filter((c) => c.case_id.startsWith("GF-RAG-"));
check(ragCases.length >= 26, "m3-parity-report.json has >= 26 GF-RAG cases");
check(ragCases.every((c) => c.result === "PASS"), "m3-parity-report.json all GF-RAG PASS");

const golden = read("m3-golden-run-report.json");
check(golden.frozen_mutations === 0, "m3-golden-run-report.json frozen_mutations=0");
check(golden.failed === 0, "m3-golden-run-report.json failed=0");

const idx = read("rag-index-report.json");
check(idx.faiss_available === true && idx.index_wrapper === "IndexIDMap2(IndexFlatIP)", "rag-index-report.json faiss structure");

const deps = read("m3-python-dependencies.json");
check(Array.isArray(deps.network_packages_added) && deps.network_packages_added.length === 0, "m3-python-dependencies.json no network packages");

const rpc = read("m3-rag-rpc-report.json");
check(rpc.all_passed === true, "m3-rag-rpc-report.json all_passed");

if (failures.length > 0) {
  console.error("M3 report verification FAILED: " + failures.join("; "));
  process.exit(1);
}
console.log("M3 reports verified OK.");
