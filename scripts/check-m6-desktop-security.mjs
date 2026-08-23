// M6 desktop security check (clean-room). Static verification + reads the real
// Electron smoke result. Generates rebuild/reports/m6-security-report.json.
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "PASS " : "FAIL ") + msg); };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs|html|css)$/.test(e)) out.push(p);
  }
  return out;
}

const desktopSrc = join(ROOT, "apps", "desktop", "src");
const allFiles = walk(desktopSrc);
const all = allFiles.map((p) => readFileSync(p, "utf-8")).join("\n");
const rendererFiles = allFiles.filter((p) => p.includes("renderer"));
const rendererSrc = rendererFiles.map((p) => readFileSync(p, "utf-8")).join("\n");
const preloadSrc = readFileSync(join(desktopSrc, "preload", "index.ts"), "utf-8");
const mainIndexSrc = readFileSync(join(desktopSrc, "main", "index.ts"), "utf-8");
const windowPolicySrc = readFileSync(join(desktopSrc, "main", "window-policy.ts"), "utf-8");

const ctxIso = windowPolicySrc.includes("contextIsolation: true");
const nodeIntFalse = windowPolicySrc.includes("nodeIntegration: false");
const sandboxTrue = windowPolicySrc.includes("sandbox: true");
const report = {
  context_isolation: ctxIso,
  node_integration: !nodeIntFalse ? "FAIL" : false,
  sandbox: sandboxTrue,
  raw_ipc_exposed: false,
  renderer_node_access: false,
  renderer_fs_access: false,
  renderer_sqlite_access: false,
  renderer_child_process_access: false,
  csp: false,
  remote_scripts: false,
  remote_navigation: false,
  webview: false,
  seller_webcontents: false,
  plaintext_secret_projection: false,
  sender_guard: false,
  no_network: false,
  limitations: [],
  all_passed: false,
};

check(ctxIso, "contextIsolation=true");
check(nodeIntFalse, "nodeIntegration=false");
check(sandboxTrue, "sandbox=true");
if (!nodeIntFalse) report.node_integration = true; // actual value would be true => FAIL

// raw ipcRenderer must never be exposed via contextBridge
report.raw_ipc_exposed = /contextBridge\.exposeInMainWorld\(\s*"ipcRenderer"/.test(preloadSrc) ||
  /exposeInMainWorld\([^)]*ipcRenderer/.test(preloadSrc);
check(!report.raw_ipc_exposed, "no raw ipcRenderer exposure");

// renderer must not touch Node/fs/sqlite/child_process/raw ipc
report.renderer_node_access = /require\(|process\.env|node:fs|node:path/.test(rendererSrc);
report.renderer_fs_access = /node:fs|require\(["']fs["']/.test(rendererSrc);
report.renderer_sqlite_access = /node:sqlite|DatabaseSync/.test(rendererSrc);
report.renderer_child_process_access = /child_process|node:child_process/.test(rendererSrc);
check(!report.renderer_node_access, "renderer has no Node access");
check(!report.renderer_fs_access, "renderer has no fs access");
check(!report.renderer_sqlite_access, "renderer has no sqlite access");
check(!report.renderer_child_process_access, "renderer has no child_process access");

// CSP: meta tag in index.html + header in main + connect-src none
const html = readFileSync(join(desktopSrc, "renderer", "index.html"), "utf-8");
report.csp = html.includes("Content-Security-Policy") && html.includes("connect-src 'none'") && html.includes("script-src 'self'");
check(report.csp, "CSP present with connect-src 'none' + script-src 'self'");

// remote scripts / remote navigation
report.remote_scripts = /<script[^>]+src=["']https?:/.test(html) || /<link[^>]+href=["']https?:/.test(html);
check(!report.remote_scripts, "no remote script/link assets");
report.remote_navigation = !mainIndexSrc.includes("setWindowOpenHandler") || !mainIndexSrc.includes("will-navigate");
check(!report.remote_navigation, "external navigation denied by default");

// webview / seller WebContents embedding
report.webview = /<webview/.test(all) || /new WebContentsView/.test(all) || /new BrowserView/.test(all);
check(!report.webview, "no webview/BrowserView/WebContentsView embedding");

const sellerUrls = ["pinduoduo.com", "yangkeduo.com", "doudian.com", "jd.com", "kuaishou.com", "taobao.com", "qianniu.com", "xianyu.com"];
report.seller_webcontents = sellerUrls.some((u) => all.toLowerCase().includes(u.toLowerCase()));
check(!report.seller_webcontents, "no seller platform URLs");

// plaintext secret projection
const secretTokens = ["credential_ref", "api_key", "client_secret", "access_token", "SecretStore"];
report.plaintext_secret_projection = secretTokens.some((t) => rendererSrc.includes(t) || preloadSrc.includes(t));
check(!report.plaintext_secret_projection, "no plaintext secret projection");

// sender guard
report.sender_guard = mainSrcHasGuard(desktopSrc);
check(report.sender_guard, "sender guard exists");

// no network in desktop + desktop-ipc source (best-effort static; runtime smoke counts calls).
// M7 PDD platform host is excluded here (its navigation policy holds production HTTPS
// host config as data/control, allowed per TASK-022 §58; its runtime is verified by
// check-m7-pdd-security.mjs + the M7 smokes with external_network_calls=0).
const nonPddFiles = allFiles.filter((f) => !f.includes(sep + "platforms" + sep) && !f.includes("platform-preloads"));
const nonPddSrc = nonPddFiles.map((p) => readFileSync(p, "utf-8")).join("\n");
report.no_network = !/fetch\(|https?:|net\.connect|new WebSocket|node:http|node:https|axios|got\(|undici/.test(nonPddSrc) &&
  !/fetch\(|net\.connect|new WebSocket|node:http|node:https|axios/.test(readFileSync(join(ROOT, "packages", "desktop-ipc", "src", "index.ts"), "utf-8") + readFileSync(join(ROOT, "packages", "desktop-ipc", "src", "channels.ts"), "utf-8"));
check(report.no_network, "no network APIs in desktop source (excluding M7 PDD host)");

function mainSrcHasGuard(dir) {
  const guardSrc = readFileSync(join(dir, "main", "ipc", "ipc-guard.ts"), "utf-8");
  return guardSrc.includes("FORBIDDEN_SENDER") && guardSrc.includes("isTrustedWindow");
}

// Real smoke evidence (if present) enriches the report.
const smokeReportPath = join(ROOT, "reports", "m6-electron-smoke-report.json");
if (existsSync(smokeReportPath)) {
  const smoke = JSON.parse(readFileSync(smokeReportPath, "utf-8"));
  report.limitations.push("external_network_calls=" + smoke.external_network_calls);
  report.limitations.push("electron_smoke_result=" + smoke.result);
}

report.all_passed = failures.length === 0;
writeFileSync(join(ROOT, "reports", "m6-security-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");

if (failures.length > 0) {
  console.error("M6 desktop security check FAILED: " + failures.join("; "));
  process.exit(1);
}
console.log("M6 desktop security check PASS.");
