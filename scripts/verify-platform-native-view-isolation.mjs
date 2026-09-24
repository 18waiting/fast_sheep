// Local-fixture-only Electron verification for Main-owned native view selection.
// Writes all project-controlled results and the isolated HOME/TMPDIR under .tmp.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktop = join(root, "apps", "desktop");
const require = createRequire(join(desktop, "package.json"));
const electron = require("electron");
const main = join(desktop, "dist", "main", "index.js");
const runRoot = join(root, ".tmp", "platform-native-view-isolation");
mkdirSync(runRoot, { recursive: true });
const runDir = mkdtempSync(join(runRoot, "run-"));
for (const subdir of ["home/Library/Application Support", "home/.config", "cache", "tmp", "data"]) {
  mkdirSync(join(runDir, subdir), { recursive: true });
}
const resultFile = join(runDir, "result.json");
const logFile = join(runDir, "electron.log");
if (!existsSync(main)) {
  console.error("NOT_RUN: desktop build missing; run pnpm --filter @fastwork/desktop build first");
  process.exit(1);
}
const env = {
  ...process.env,
  HOME: join(runDir, "home"),
  TMPDIR: join(runDir, "tmp") + "/",
  XDG_CACHE_HOME: join(runDir, "cache"),
  XDG_CONFIG_HOME: join(runDir, "home", ".config"),
  FASTWORK_DATA_DIR: join(runDir, "data"),
  FASTWORK_DESKTOP_TEST_MODE: "1",
  FASTWORK_DESKTOP_M7_ISOLATION_RESULT_FILE: resultFile,
};
delete env.ELECTRON_RUN_AS_NODE;
// The test-mode Main entry has no vertical/Worker probe configured here.
for (const name of [
  "FASTWORK_DESKTOP_M7_SMOKE_RESULT_FILE", "FASTWORK_DESKTOP_M7_VERTICAL_RESULT_FILE",
  "FASTWORK_DESKTOP_M7_VERTICAL", "FASTWORK_DESKTOP_M8_PLATFORM",
  "FASTWORK_DESKTOP_M8_SMOKE_RESULT_FILE", "FASTWORK_DESKTOP_M8_MULTI_RESULT_FILE",
  "FASTWORK_DESKTOP_M8_VERTICAL_RESULT_FILE",
]) delete env[name];
const child = spawnSync(electron, [main], { cwd: desktop, env, timeout: 75_000, encoding: "utf8", maxBuffer: 1024 * 1024 });
writeFileSync(logFile, (child.stdout ?? "") + (child.stderr ?? ""));
let result;
try { result = JSON.parse(readFileSync(resultFile, "utf8")); } catch { /* missing or invalid = failure */ }
const checks = [
  ["electron_exit", child.status === 0 && !child.error],
  ["probe_result", result?.result === "PASS" && result?.errors?.length === 0],
  ["shop_switch", result?.shop_switch === true],
  ["cross_platform_view_isolation", result?.cross_platform_view_isolation === true],
  ["native_view_bounds_rejected", result?.native_view_bounds_rejected === true],
  ["fixture_urls_local", result?.fixture_urls_local === true],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
console.log(`Evidence: ${resultFile} (Electron log: ${logFile})`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
