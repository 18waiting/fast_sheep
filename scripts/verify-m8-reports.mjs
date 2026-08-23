// M8 (TASK-023): verify all M8 reports exist and reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");
function read(n) { const p = join(REPORTS, n); if (!existsSync(p)) throw new Error("MISSING REPORT: " + n); return JSON.parse(readFileSync(p, "utf-8")); }
const failures = [];
function check(c, m) { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); }

const t = read("m8-platform-test-report.json");
check(t.all_passed === true, "m8-platform-test-report.json all_passed");
check(t.platform_package_tests.passed === 107, "m8-platform-test-report.json platform package 107");

const smoke = read("m8-electron-smoke-report.json");
check(smoke.all_passed === true, "m8-electron-smoke-report.json all platforms PASS");
for (const p of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) check(smoke.platforms[p]?.result === "PASS", "m8-electron-smoke-report.json " + p);

const vert = read("m8-vertical-report.json");
check(vert.result === "PASS", "m8-vertical-report.json PASS");
for (const p of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
  check(vert.scenarios[p]?.suggestion_ready === true && vert.scenarios[p]?.exactly_once_send === true, "m8-vertical-report.json " + p);
}

const par = read("m8-platform-parity-report.json");
check(par.all_passed === true, "m8-platform-parity-report.json all_passed");
check(par.passed === par.executed, "m8-platform-parity-report.json executed==passed");

const sec = read("m8-platform-security-report.json");
check(sec.all_passed === true, "m8-platform-security-report.json all_passed");
check(sec.blind_retry_after_uncertain_send === false, "m8-platform-security-report.json blind_retry_after_uncertain_send=false");

const dom = read("m8-dom-fixture-report.json");
check(dom.all_passed === true && dom.external_resources === 0 && dom.real_customer_data === 0 && dom.proprietary_assets === 0, "m8-dom-fixture-report.json clean");

const multi = read("m8-multi-platform-isolation-report.json");
check(multi.all_passed === true, "m8-multi-platform-isolation-report.json all_passed");

const nn = read("m8-no-network-report.json");
check(nn.result === "PASS" && nn.unit_tests_external_calls === 0 && nn.vertical_smoke_external_calls === 0, "m8-no-network-report.json 0 external calls");

const dep = read("m8-dependencies.json");
check(dep.ui_framework_change === false && dep.network_automation_framework_added === false, "m8-dependencies.json no ui/network automation");

if (failures.length > 0) { console.error("M8 report verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M8 reports verified OK.");
