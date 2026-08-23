// M7 (TASK-022): verify all M7 reports exist and reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");
function read(n) { const p = join(REPORTS, n); if (!existsSync(p)) throw new Error("MISSING REPORT: " + n); return JSON.parse(readFileSync(p, "utf-8")); }
const failures = [];
function check(c, m) { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); }

const t = read("m7-pdd-test-report.json");
check(t.all_passed === true, "m7-pdd-test-report.json all_passed");
check(t.platform_pdd_tests.passed === 62, "m7-pdd-test-report.json platform_pdd_tests 62");
check(t.desktop_pdd_tests.passed === 44, "m7-pdd-test-report.json desktop_pdd_tests 44");

const dom = read("m7-pdd-dom-fixture-report.json");
check(dom.all_passed === true, "m7-pdd-dom-fixture-report.json all_passed");
check(dom.external_resources === 0 && dom.real_customer_data === 0 && dom.proprietary_assets === 0, "m7-pdd-dom-fixture-report.json zero external/customer/proprietary");

const smoke = read("m7-pdd-electron-smoke-report.json");
check(smoke.result === "PASS", "m7-pdd-electron-smoke-report.json PASS");
check(smoke.external_network_calls === 0 && smoke.cookie_export_calls === 0 && smoke.token_export_calls === 0, "m7-pdd-electron-smoke-report.json no network/cookie/token");

const vert = read("m7-pdd-vertical-report.json");
check(vert.result === "PASS", "m7-pdd-vertical-report.json PASS");
for (const s of ["inbound_to_orchestrator", "orchestrator_to_worker", "conversation_generate", "suggestion_ready", "outbound_to_pdd", "exactly_once_send", "final_sent_state", "manual_takeover_blocks_ai", "shop_isolation"]) {
  check(vert.scenarios[s] === "PASS", "m7-pdd-vertical-report.json scenario " + s);
}
check(vert.external_network_calls === 0, "m7-pdd-vertical-report.json external_network_calls 0");

const par = read("m7-platform-parity-report.json");
check(par.all_passed === true, "m7-platform-parity-report.json all_passed");
check(par.pdd_applicable_passed === par.pdd_applicable_executed && par.pdd_applicable_passed === 10, "m7-platform-parity-report.json 10/10 PDD-applicable PASS");
check(par.other_platform_deferred === 3, "m7-platform-parity-report.json 3 deferred to M8");

const sec = read("m7-pdd-security-report.json");
check(sec.all_passed === true, "m7-pdd-security-report.json all_passed");
check(sec.context_isolation === true && sec.node_integration === false && sec.sandbox === true, "m7-pdd-security-report.json view isolation");
check(sec.seller_page_desktop_api_exposed === false && sec.raw_ipc_exposed === false, "m7-pdd-security-report.json no seller-page API/IPC");
check(sec.cookie_export_calls === 0 && sec.token_extraction === false && sec.password_handling === false, "m7-pdd-security-report.json no auth material");
check(sec.captcha_automation === false && sec.anti_bot_bypass === false && sec.fingerprint_spoofing === false && sec.webdriver_evasion === false, "m7-pdd-security-report.json no anti-bot");

const ses = read("m7-pdd-session-report.json");
check(ses.all_passed === true, "m7-pdd-session-report.json all_passed");
check(ses.partitions_unique === true && ses.cross_shop_message_leak === true && ses.cross_shop_send_leak === true, "m7-pdd-session-report.json isolation");

const nn = read("m7-no-network-report.json");
check(nn.result === "PASS" && nn.unit_tests_external_calls === 0 && nn.electron_smoke_external_calls === 0 && nn.vertical_smoke_external_calls === 0, "m7-no-network-report.json 0 external calls");

const dep = read("m7-dependencies.json");
check(dep.ui_framework_change === false && dep.network_automation_framework_added === false, "m7-dependencies.json no ui/network automation framework");
check(dep.all_requirements_satisfied === true, "m7-dependencies.json requirements satisfied");

if (failures.length > 0) { console.error("M7 report verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M7 reports verified OK.");
