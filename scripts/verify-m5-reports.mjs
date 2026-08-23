// Clean-room implementation. M5 (TASK-020): verify M5 reports reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");
function read(n) { const p = join(REPORTS, n); if (!existsSync(p)) throw new Error("MISSING REPORT: " + n); return JSON.parse(readFileSync(p, "utf-8")); }
const failures = [];
function check(c, m) { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); }

const c = read("m5-conversation-test-report.json"); check(c.all_passed && c.passed === 25, "m5-conversation-test-report.json 25/25");
const o = read("m5-orchestrator-test-report.json"); check(o.all_passed && o.passed === 24, "m5-orchestrator-test-report.json 24/24");
const p = read("m5-parity-report.json"); const total = p.conversation_cases.length + p.orchestrator_cases.length; check(p.all_passed && total === 38, "m5-parity-report.json all_passed (38 cases)");
const g = read("m5-golden-run-report.json"); check(g.frozen_mutations === 0 && g.conversation_passed === 16 && g.orchestrator_passed === 22, "m5-golden-run-report.json 16+22 passed, frozen_mutations=0");
const fb = read("m5-feedback-intent-report.json"); check(fb.all_passed && fb.MANUAL.knowledge_mutation_called === false && fb.AUTO.knowledge_mutation_called === false && fb.NO_SAVE.knowledge_mutation_called === false, "m5-feedback-intent-report.json no knowledge mutation");
const e2e = read("m5-end-to-end-report.json"); check(e2e.result === "PASS", "m5-end-to-end-report.json PASS");
const rpc = read("m5-conversation-rpc-report.json"); check(rpc.result === "PASS" && rpc.external_network_calls === 0, "m5-conversation-rpc-report.json PASS, 0 external calls");
const nn = read("m5-no-network-report.json"); check(nn.result === "PASS", "m5-no-network-report.json PASS");
const d = read("m5-python-dependencies.json"); check(d.network_packages_added.length === 0, "m5-python-dependencies.json no network packages");

if (failures.length > 0) { console.error("M5 report verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M5 reports verified OK.");
