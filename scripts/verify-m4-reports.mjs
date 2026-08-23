// Clean-room implementation. M4 (TASK-019): verify M4 reports reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");

function read(name) { const p = join(REPORTS, name); if (!existsSync(p)) throw new Error("MISSING REPORT: " + name); return JSON.parse(readFileSync(p, "utf-8")); }
const failures = [];
function check(cond, msg) { if (!cond) failures.push(msg); console.log((cond ? "PASS " : "FAIL ") + msg); }

const p = read("m4-prompt-test-report.json"); check(p.all_passed && p.fixtures_passed === 12 && p.fixtures_passed === p.fixtures_executed, "m4-prompt-test-report.json 12/12");
const t = read("m4-tool-test-report.json"); check(t.all_passed && t.fixtures_passed === 12 && t.fixtures_passed === t.fixtures_executed, "m4-tool-test-report.json 12/12");
const pr = read("m4-provider-test-report.json"); check(pr.all_passed && pr.fixtures_passed === 14 && pr.fixtures_passed === pr.fixtures_executed, "m4-provider-test-report.json 14/14");
check(pr.live_network_calls === 0, "m4-provider-test-report.json live_network_calls=0");
const s = read("m4-security-report.json"); check(s.all_passed, "m4-security-report.json all_passed");
const par = read("m4-parity-report.json"); check(par.all_passed && par.cases.length === 44, "m4-parity-report.json all_passed (44 cases)");
const g = read("m4-golden-run-report.json"); check(g.frozen_mutations === 0 && g.failed_case_ids.length === 0, "m4-golden-run-report.json frozen_mutations=0");
const prp = read("m4-provider-protocol-report.json"); check(prp.all_live_transport_disabled === true, "m4-provider-protocol-report.json live transport disabled");
const d = read("m4-python-dependencies.json"); check(d.network_packages_added.length === 0, "m4-python-dependencies.json no network packages");

if (failures.length > 0) { console.error("M4 report verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M4 reports verified OK.");
