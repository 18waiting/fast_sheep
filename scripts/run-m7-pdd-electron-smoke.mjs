// M7 real-Electron PDD smoke (clean-room). Launches the actual Electron app in
// test mode, activates a PDD shop (real WebContentsView + sandboxed preload +
// local synthetic fixture), and validates the Main-side PDD smoke probe.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const require = createRequire(join(ROOT, "apps", "desktop", "package.json"));
const electronPath = require("electron");
const MAIN_ENTRY = join(ROOT, "apps", "desktop", "dist", "main", "index.js");

if (!existsSync(MAIN_ENTRY)) {
  console.error("FAIL: desktop not built: " + MAIN_ENTRY);
  process.exit(1);
}

const resultFile = join(mkdtempSync(join(tmpdir(), "m7-smoke-")), "pdd-smoke-result.json");
const child = spawn(electronPath, [MAIN_ENTRY], {
  cwd: ROOT,
  env: {
    ...process.env,
    FASTWORK_DESKTOP_TEST_MODE: "1",
    FASTWORK_DESKTOP_M7_SMOKE_RESULT_FILE: resultFile,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (d) => { stderr += String(d); });

const timeout = setTimeout(() => {
  console.error("FAIL: M7 PDD Electron smoke timed out");
  child.kill();
  process.exit(1);
}, 90000);

child.on("exit", () => {
  clearTimeout(timeout);
  if (!existsSync(resultFile)) {
    console.error("FAIL: no M7 PDD smoke result file. stderr: " + stderr.slice(0, 2000));
    process.exit(1);
  }
  const r = JSON.parse(readFileSync(resultFile, "utf-8"));
  const checks = [
    ["webcontentsview_created", r.webcontentsview_created === true],
    ["partition", typeof r.partition === "string" && /^persist:shop-[A-Za-z0-9._-]+$/.test(r.partition)],
    ["preload_loaded", r.preload_loaded === true],
    ["fixture_loaded", r.fixture_loaded === true],
    ["page_ready", r.page_ready === true],
    ["message_received", r.message_received === true],
    ["message_normalized", r.message_normalized === true],
    ["bounds_applied", r.bounds_applied === true],
    ["send_text", r.send_text === true],
    ["send_ack", r.send_ack === true],
    ["manual_takeover_event", r.manual_takeover_event === true],
    ["session_disposed", r.session_disposed === true],
    ["cookie_export_calls", r.cookie_export_calls === 0],
    ["token_export_calls", r.token_export_calls === 0],
    ["external_network_calls", r.external_network_calls === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
  writeFileSync(join(ROOT, "reports", "m7-pdd-electron-smoke-report.json"), JSON.stringify(r, null, 2) + "\n", "utf-8");
  rmSync(dirname(resultFile), { recursive: true, force: true });
  if (failed.length > 0 || r.result !== "PASS") {
    console.error("M7 PDD Electron smoke FAILED: " + failed.map(([n]) => n).join(", "));
    console.error("errors: " + JSON.stringify(r.errors));
    process.exit(1);
  }
  console.log("M7 PDD Electron smoke PASS.");
});
