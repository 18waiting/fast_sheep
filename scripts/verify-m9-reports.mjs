// M9 (TASK-024): verify all M9 reports exist and reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");
function read(n) { const p = join(REPORTS, n); if (!existsSync(p)) throw new Error("MISSING REPORT: " + n); return JSON.parse(readFileSync(p, "utf-8")); }
const failures = [];
function check(c, m) { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); }

const h = read("m9-handoff-test-report.json");
check(h.all_passed === true && h.passed === 21, "m9-handoff-test-report.json 21/21");
const f = read("m9-feedback-test-report.json");
check(f.all_passed === true && f.passed === 7, "m9-feedback-test-report.json 7/7");
const par = read("m9-parity-report.json");
check(par.all_passed === true, "m9-parity-report.json all_passed");
check(par.handoff_cases.passed === 21 && par.feedback_cases.passed === 7, "m9-parity-report.json handoff+feedback passed");
const golden = read("m9-golden-run-report.json");
check(golden.result === "PASS" && golden.frozen_mutations === 0, "m9-golden-run-report.json PASS");
const own = read("m9-feedback-ownership-report.json");
check(own.node_writes_knowledge === false && own.worker_writes_feedback_record === false && own.no_save_worker_calls === 0, "m9-feedback-ownership-report.json ownership");
const effect = read("m9-feedback-effect-report.json");
check(effect.no_save_worker_calls === 0 && effect.all_passed === true, "m9-feedback-effect-report.json");
const plat = read("m9-handoff-platform-report.json");
check(plat.platform_adapter_target_selection === false, "m9-handoff-platform-report.json adapter no target selection");
const vert = read("m9-vertical-report.json");
check(vert.handoff_vertical === "PASS" && vert.feedback_vertical === "PASS" && vert.external_network_calls === 0, "m9-vertical-report.json");
const nn = read("m9-no-network-report.json");
check(nn.result === "PASS", "m9-no-network-report.json PASS");
const mig = read("m9-migration-report.json");
check(mig.all_passed === true, "m9-migration-report.json all_passed");
const kuaishou = read("m9-kuaishou-capability-preflight-report.json");
check(kuaishou.regression_result === "PASS", "m9-kuaishou-capability-preflight-report.json");
const common = read("m9-platform-common-preflight-report.json");
check(common.result === "PASS" && common.direct_tests_passed === 5, "m9-platform-common-preflight-report.json");

if (failures.length > 0) { console.error("M9 report verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M9 reports verified OK.");
