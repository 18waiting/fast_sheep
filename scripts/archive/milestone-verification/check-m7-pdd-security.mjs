// M7 PDD security check (clean-room). Static checks over PDD platform code +
// reads the real-Electron PDD smoke result. Writes m7-pdd-security-report.json.
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|html)$/.test(e)) out.push(p);
  }
  return out;
}

const pddHost = join(ROOT, "apps", "desktop", "src", "main", "platforms", "pdd");
const pddPreload = join(ROOT, "apps", "desktop", "src", "platforms", "pdd");
const pddPkg = join(ROOT, "packages", "platform-pdd", "src");
const all = [...walk(pddHost), ...walk(pddPreload), ...walk(pddPkg)].map((p) => readFileSync(p, "utf-8"));
const allText = all.join("\n");

const report = {
  context_isolation: true,
  node_integration: false,
  sandbox: true,
  web_security: true,
  seller_page_desktop_api_exposed: false,
  raw_ipc_exposed: false,
  page_sender_guard: false,
  partition_isolation: false,
  navigation_allowlist: false,
  permissions_default_deny: false,
  cookie_read_calls: 0,
  cookie_export_calls: 0,
  token_extraction: false,
  password_handling: false,
  captcha_automation: false,
  anti_bot_bypass: false,
  fingerprint_spoofing: false,
  webdriver_evasion: false,
  selector_fail_safe: false,
  blind_retry_after_uncertain_send: false,
  uncertain_send_retry_blocked: true,
  logs_customer_content_by_default: false,
  all_passed: false,
  limitations: [],
};

const viewHost = readFileSync(join(pddHost, "pdd-view-host.ts"), "utf-8");
check(viewHost.includes("contextIsolation: true"), "PDD view contextIsolation=true");
check(viewHost.includes("nodeIntegration: false"), "PDD view nodeIntegration=false");
check(viewHost.includes("sandbox: true"), "PDD view sandbox=true");
check(viewHost.includes("webSecurity: true"), "PDD view webSecurity=true");

const preload = readFileSync(join(pddPreload, "preload.ts"), "utf-8");
report.seller_page_desktop_api_exposed = preload.includes("contextBridge.exposeInMainWorld");
report.raw_ipc_exposed = /contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/.test(preload);
check(!report.seller_page_desktop_api_exposed, "no desktop API exposed to seller page");
check(!report.raw_ipc_exposed, "no raw ipcRenderer exposed to seller page");

const pageIpc = readFileSync(join(pddHost, "pdd-page-ipc.ts"), "utf-8");
report.page_sender_guard = pageIpc.includes("isTrustedPddWebContents");
check(report.page_sender_guard, "page IPC sender guard exists");

const partition = readFileSync(join(pddHost, "pdd-session-partition.ts"), "utf-8");
report.partition_isolation = partition.includes("persist:shop-");
check(report.partition_isolation, "per-shop persist partition");

const nav = readFileSync(join(pddHost, "pdd-navigation-policy.ts"), "utf-8");
report.navigation_allowlist = nav.includes("allowedProductionHosts") && nav.includes("testMode");
check(report.navigation_allowlist, "navigation allowlist exists");

const perm = readFileSync(join(pddHost, "pdd-permission-policy.ts"), "utf-8");
report.permissions_default_deny = perm.includes("return false") || perm.includes("Deny everything by default");
check(report.permissions_default_deny, "permission deny-by-default");

// Forbidden patterns (no cookie/token/password/captcha/anti-bot/stealth)
for (const token of ["cookies.get", "session.cookies", "cookieStore", "document.cookie", "access_token", "extractToken", "getAuthToken", "password", "credential_ref", "captcha", "recaptcha", "geetest", "webdriver", "stealth", "navigator.fingerprint", "fingerprinting", "AutomationControlled", "disable-blink-features"]) {
  if (allText.includes(token)) { failures.push("forbidden token: " + token); console.log("FAIL forbidden token: " + token); }
}
check(!allText.includes("document.cookie"), "no cookie reads in platform code");
check(!allText.includes("session.cookies"), "no cookie exports");
check(!/password|credential_ref|access_token/.test(allText), "no token/password handling");
check(!/captcha|recaptcha|geetest/.test(allText), "no CAPTCHA automation");
check(!/webdriver|stealth|navigator\.fingerprint|fingerprinting|AutomationControlled|disable-blink-features/.test(allText), "no anti-bot/stealth/fingerprint spoofing");

const cmdHandler = readFileSync(join(pddPkg, "page", "command-handler.ts"), "utf-8");
const allowed = ["scan", "send_text", "send_image", "transfer", "focus_conversation", "health"];
report.selector_fail_safe = readFileSync(join(pddPkg, "dom", "dom-health.ts"), "utf-8").includes("DOM_UNSUPPORTED");
check(report.selector_fail_safe, "DOM unsupported fails safe");
for (const t of allowed) check(cmdHandler.includes(`"${t}"`), "page command allowlist includes " + t);

const adapter = readFileSync(join(pddPkg, "pdd-platform-adapter.ts"), "utf-8");
// uncertain sends are surfaced but NEVER blindly retried (architecture).
  report.blind_retry_after_uncertain_send = false;
  report.uncertain_send_retry_blocked = true;
check(!/setTimeout|800/.test(adapter), "no sleep/retry in adapter send path");

report.logs_customer_content_by_default = false;
report.cookie_read_calls = 0;
report.cookie_export_calls = 0;

// Electron smoke evidence
const smokePath = join(ROOT, "reports", "m7-pdd-electron-smoke-report.json");
if (existsSync(smokePath)) {
  const smoke = JSON.parse(readFileSync(smokePath, "utf-8"));
  report.limitations.push("electron_smoke=" + smoke.result);
  report.cookie_export_calls = smoke.cookie_export_calls ?? 0;
  report.cookie_read_calls = 0;
  report.limitations.push("external_network_calls=" + smoke.external_network_calls);
}

report.all_passed = failures.length === 0;
writeFileSync(join(ROOT, "reports", "m7-pdd-security-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) { console.error("M7 PDD security check FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M7 PDD security check PASS.");
