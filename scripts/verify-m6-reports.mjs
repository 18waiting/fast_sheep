// M6 (TASK-021): verify all M6 reports exist and reflect passing results.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");
function read(n) { const p = join(REPORTS, n); if (!existsSync(p)) throw new Error("MISSING REPORT: " + n); return JSON.parse(readFileSync(p, "utf-8")); }
const failures = [];
function check(c, m) { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); }

const ipc = read("m6-ipc-test-report.json");
check(ipc.all_passed === true, "m6-ipc-test-report.json all_passed");
check(ipc.desktop_ipc_tests.passed === 9, "m6-ipc-test-report.json desktop_ipc_tests 9");
check(ipc.main_handler_tests.passed === 16, "m6-ipc-test-report.json main_handler_tests 16");
check(ipc.preload_tests.passed === 7, "m6-ipc-test-report.json preload_tests 7");
check(ipc.channels_registered === 12, "m6-ipc-test-report.json channels_registered 12");
check(ipc.channels_missing_handler === 0, "m6-ipc-test-report.json no missing handler");
check(ipc.channels_missing_preload_mapping === 0, "m6-ipc-test-report.json no missing preload mapping");
check(ipc.ad_hoc_channels_found === 0, "m6-ipc-test-report.json no ad-hoc channels");

const dt = read("m6-desktop-test-report.json");
check(dt.all_passed === true, "m6-desktop-test-report.json all_passed");
check(dt.typescript_tests.passed === 75 && dt.typescript_tests.failed === 0, "m6-desktop-test-report.json 75/75");
for (const area of ["main_bootstrap", "window_security", "workbench_projection", "shop_switch", "suggestion_actions", "mode_toggle", "countdown_projection", "keyboard_shortcuts", "worker_status", "event_reducer", "stale_event_handling", "no_business_authority", "no_secret_projection", "no_platform_embedding"]) {
  check(dt.areas[area] === "PASS", "m6-desktop-test-report.json area " + area);
}

const smoke = read("m6-electron-smoke-report.json");
check(smoke.result === "PASS", "m6-electron-smoke-report.json PASS");
check(smoke.external_network_calls === 0, "m6-electron-smoke-report.json 0 external calls");
check(smoke.preload_loaded === true && smoke.renderer_loaded === true && smoke.bootstrap_ipc === true && smoke.manual_command_round_trip === true, "m6-electron-smoke-report.json main/preload/renderer exercised");

const sec = read("m6-security-report.json");
check(sec.all_passed === true, "m6-security-report.json all_passed");
check(sec.context_isolation === true && sec.node_integration === false && sec.sandbox === true, "m6-security-report.json contextIsolation/sandbox");

const proj = read("m6-workbench-projection-report.json");
check(proj.all_passed === true, "m6-workbench-projection-report.json all_passed");
for (const s of ["human_review", "full_auto", "countdown", "manual_send", "no_save", "cancel", "send_started", "send_completed", "send_failed", "takeover", "worker_restarting", "shop_switch", "stale_event"]) {
  check(proj.scenarios[s] === "PASS", "m6-workbench-projection-report.json scenario " + s);
}

const conf = read("m6-conformance-report.json");
check(conf.all_passed === true, "m6-conformance-report.json all_passed");
check(conf.mapping.length >= 10, "m6-conformance-report.json >=10 mappings");
const ids = conf.mapping.map((m) => m.behavior);
for (const id of ["GF-ORCH-001", "GF-ORCH-003", "GF-ORCH-004", "GF-ORCH-005", "GF-ORCH-006", "GF-ORCH-011", "GF-ORCH-012", "GF-ORCH-013", "GF-ORCH-014", "GF-ORCH-015"]) {
  check(ids.includes(id), "m6-conformance-report.json maps " + id);
}

const deps = read("m6-dependencies.json");
check(deps.remote_dependencies.length === 0, "m6-dependencies.json no remote deps");
check(deps.network_dependencies_added.length === 0, "m6-dependencies.json no network deps");
check(deps.all_requirements_satisfied === true, "m6-dependencies.json requirements satisfied");

if (failures.length > 0) { console.error("M6 report verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M6 reports verified OK.");
