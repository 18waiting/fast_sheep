// M8 jd real-Electron smoke (clean-room). Local synthetic fixture only.
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

const resultFile = join(mkdtempSync(join(tmpdir(), "m8-jd-")), "smoke.json");
const child = spawn(electronPath, [MAIN_ENTRY], {
  cwd: ROOT,
  env: { ...process.env, FASTWORK_DESKTOP_TEST_MODE: "1", FASTWORK_DESKTOP_M8_PLATFORM: "jd", FASTWORK_DESKTOP_M8_SMOKE_RESULT_FILE: resultFile, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (d) => { stderr += String(d); });
const timeout = setTimeout(() => { console.error("FAIL: jd smoke timed out"); child.kill(); process.exit(1); }, 90000);
child.on("exit", () => {
  clearTimeout(timeout);
  if (!existsSync(resultFile)) { console.error("FAIL: no jd result file; stderr: " + stderr.slice(0, 1200)); process.exit(1); }
  const r = JSON.parse(readFileSync(resultFile, "utf-8"));
  const checks = [
    ["webcontentsview_created", r.webcontentsview_created === true],
    ["page_ready", r.page_ready === true],
    ["message_received", r.message_received === true],
    ["send_text", r.send_text === true],
    ["send_ack", r.send_ack === true],
    ["session_disposed", r.session_disposed === true],
    ["cookie_export_calls", r.cookie_export_calls === 0],
    ["token_export_calls", r.token_export_calls === 0],
    ["external_network_calls", r.external_network_calls === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [n, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + "jd " + n);
  const report = { platform: "jd", ...r, all_passed: failed.length === 0 && r.result === "PASS" };
  writeFileSync(join(ROOT, "reports", "m8-jd-electron-smoke.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  rmSync(dirname(resultFile), { recursive: true, force: true });
  if (failed.length > 0 || r.result !== "PASS") { console.error("M8 jd electron smoke FAILED: " + failed.map(([n]) => n).join(", ")); process.exit(1); }
  console.log("M8 jd electron smoke PASS.");
});
