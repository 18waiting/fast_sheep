// M6 real-Electron smoke (clean-room). Launches the ACTUAL Electron app with
// FASTWORK_DESKTOP_TEST_MODE=1, then validates the machine-readable probe
// written by the Main process (Main + Preload + Renderer + real typed IPC).
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

const resultFile = join(mkdtempSync(join(tmpdir(), "m6-smoke-")), "smoke-result.json");

if (!existsSync(MAIN_ENTRY)) {
  console.error("FAIL: desktop not built: " + MAIN_ENTRY);
  console.error("Run: pnpm --filter @fastwork/desktop run build");
  process.exit(1);
}

const child = spawn(electronPath, [MAIN_ENTRY], {
  cwd: ROOT,
  env: {
    ...process.env,
    FASTWORK_DESKTOP_TEST_MODE: "1",
    FASTWORK_DESKTOP_SMOKE_RESULT_FILE: resultFile,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (d) => { stderr += String(d); });

const timeout = setTimeout(() => {
  console.error("FAIL: Electron smoke timed out after 60s");
  child.kill();
  process.exit(1);
}, 60000);

child.on("exit", (code) => {
  clearTimeout(timeout);
  if (!existsSync(resultFile)) {
    console.error("FAIL: no smoke result file written. exit=" + code);
    if (stderr) console.error(stderr.slice(0, 4000));
    process.exit(1);
  }
  const result = JSON.parse(readFileSync(resultFile, "utf-8"));
  writeFileSync(join(ROOT, "reports", "m6-electron-smoke-report.json"), JSON.stringify(result, null, 2) + "\n", "utf-8");
  const checks = [
    ["app_started", result.app_started === true],
    ["browser_window_created", result.browser_window_created === true],
    ["preload_loaded", result.preload_loaded === true],
    ["renderer_loaded", result.renderer_loaded === true],
    ["bootstrap_ipc", result.bootstrap_ipc === true],
    ["worker_status", result.worker_status === "ready"],
    ["synthetic_shop", result.synthetic_shop === true],
    ["snapshot_rendered", result.snapshot_rendered === true],
    ["manual_command_round_trip", result.manual_command_round_trip === true],
    ["shutdown_clean", result.shutdown_clean === true],
    ["external_network_calls", result.external_network_calls === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
  console.log("electron_version=" + result.electron_version);
  console.log("persistence_runtime_compatibility=" + result.persistence_runtime_compatibility);
  console.log("result=" + result.result);
  rmSync(dirname(resultFile), { recursive: true, force: true });
  if (failed.length > 0 || result.result !== "PASS") {
    console.error("M6 Electron smoke FAILED: " + failed.map(([n]) => n).join(", "));
    process.exit(1);
  }
  console.log("M6 Electron smoke PASS.");
});

child.on("error", (e) => {
  clearTimeout(timeout);
  console.error("FAIL: cannot spawn electron: " + e.message);
  process.exit(1);
});
