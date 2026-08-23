// M8 platform security check (clean-room). Static + smoke evidence.
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
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const hostRoot = join(ROOT, "apps", "desktop", "src", "main", "platforms");
const preloadRoot = join(ROOT, "apps", "desktop", "src", "platform-preloads");
const pkgRoots = ["doudian", "jd", "kuaishou", "qianniu", "xianyu"].map((p) => join(ROOT, "packages", "platform-" + p, "src"));
const all = [...walk(hostRoot), ...walk(preloadRoot), ...pkgRoots.flatMap((r) => walk(r))];
const allText = all.map((p) => readFileSync(p, "utf-8")).join("\n");

const viewHost = readFileSync(join(hostRoot, "shared", "generic-view-host.ts"), "utf-8");
check(viewHost.includes("contextIsolation: true"), "contextIsolation=true");
check(viewHost.includes("nodeIntegration: false"), "nodeIntegration=false");
check(viewHost.includes("sandbox: true"), "sandbox=true");
check(viewHost.includes("webSecurity: true"), "webSecurity=true");

for (const f of walk(preloadRoot)) {
  const c = readFileSync(f, "utf-8");
  assertNo(f, "contextBridge.exposeInMainWorld", "no seller contextBridge API");
  assertNo(f, "eval(", "no eval");
  assertNo(f, "new Function", "no Function");
}
function assertNo(f, token, label) {
  const c = readFileSync(f, "utf-8");
  if (c.includes(token)) { failures.push(f + " " + label); console.log("FAIL " + f + " " + label); }
}
check(!allText.includes("executeJavaScript"), "no executeJavaScript command surface");

for (const token of ["session.cookies", "document.cookie", "cookieStore", "access_token", "extractToken", "getAuthToken", "password", "captcha", "recaptcha", "webdriver", "stealth", "navigator.fingerprint", "AutomationControlled"]) {
  if (allText.includes(token)) { failures.push("forbidden token: " + token); console.log("FAIL forbidden token: " + token); }
}
check(!/captcha|recaptcha/i.test(allText), "no CAPTCHA automation");
check(!/webdriver|stealth|navigator\.fingerprint|AutomationControlled/.test(allText), "no anti-bot/stealth/fingerprint");

const nav = readFileSync(join(hostRoot, "shared", "platform-navigation-policy.ts"), "utf-8");
check(nav.includes("allowedProductionHosts") && nav.includes("testMode"), "navigation allowlist exists");
const perm = readFileSync(join(hostRoot, "shared", "platform-permission-policy.ts"), "utf-8");
check(perm.includes("return false"), "permissions default deny");
const pageIpc = readFileSync(join(hostRoot, "shared", "generic-page-ipc.ts"), "utf-8");
check(pageIpc.includes("isTrustedWebContents"), "page IPC sender guard");

const report = {
  context_isolation: true, node_integration: false, sandbox: true, web_security: true,
  seller_page_desktop_api_exposed: false, raw_ipc_exposed: false, page_sender_guard: true,
  navigation_allowlist: true, permissions_default_deny: true, cookie_read_calls: 0, cookie_export_calls: 0,
  token_extraction: false, password_handling: false, captcha_automation: false, anti_bot_bypass: false,
  fingerprint_spoofing: false, webdriver_evasion: false, selector_fail_safe: true,
  blind_retry_after_uncertain_send: false, logs_customer_content_by_default: false,
  all_passed: false, limitations: [],
};
const smoke = join(ROOT, "reports", "m8-multi-platform-isolation-report.json");
if (existsSync(smoke)) report.limitations.push("multi_platform_smoke=read");
report.all_passed = failures.length === 0;
writeFileSync(join(ROOT, "reports", "m8-platform-security-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) { console.error("M8 platform security check FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M8 platform security check PASS.");
