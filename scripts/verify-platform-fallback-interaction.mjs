// Test-mode, local-fixture-only Renderer/Main fallback interaction evidence.
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
const runRoot = join(root, ".tmp", "platform-fallback-interaction");
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
  FASTWORK_DESKTOP_FALLBACK_INTERACTION_RESULT_FILE: resultFile,
};
delete env.ELECTRON_RUN_AS_NODE;
for (const name of [
  "FASTWORK_DESKTOP_M7_SMOKE_RESULT_FILE", "FASTWORK_DESKTOP_M7_VERTICAL_RESULT_FILE",
  "FASTWORK_DESKTOP_M7_VERTICAL", "FASTWORK_DESKTOP_M7_ISOLATION_RESULT_FILE",
  "FASTWORK_DESKTOP_M8_PLATFORM", "FASTWORK_DESKTOP_M8_SMOKE_RESULT_FILE",
  "FASTWORK_DESKTOP_M8_MULTI_RESULT_FILE", "FASTWORK_DESKTOP_M8_VERTICAL_RESULT_FILE",
]) delete env[name];
const child = spawnSync(electron, [main], { cwd: desktop, env, timeout: 75_000, encoding: "utf8", maxBuffer: 1024 * 1024 });
writeFileSync(logFile, (child.stdout ?? "") + (child.stderr ?? ""));
let result;
try { result = JSON.parse(readFileSync(resultFile, "utf8")); } catch { /* missing/invalid = failure */ }
const screenshot = result?.screenshot_file;
const checks = [
  ["electron_exit", child.status === 0 && !child.error],
  ["probe_result", result?.result === "PASS" && result?.errors?.length === 0],
  ["renderer_booted", result?.renderer_booted === true],
  ["window_shown", result?.window_shown === true],
  ["pdd_a_surface", result?.pdd_a_surface === true],
  ["pdd_b_switch", result?.pdd_b_switch === true],
  ["non_pdd_close", result?.non_pdd_close === true],
  ["untagged_event_rejected", result?.untagged_event_rejected === true],
  ["stale_document_event_rejected", result?.stale_document_event_rejected === true],
  ["login_required_projection", result?.login_required_projection === true],
  ["fixture_urls_local", result?.fixture_urls_local === true],
  ["queue_all_stores_empty_after_switches", result?.queue_all_stores_empty_after_switches === true],
  ["screenshot_exists", typeof screenshot === "string" && screenshot.startsWith(runDir + "/") && existsSync(screenshot)],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
console.log(`Evidence: ${resultFile} (Electron log: ${logFile})`);
if (checks.some(([, ok]) => !ok)) {
  if (result?.errors) console.error(result.errors.join("\n"));
  if (child.error) console.error(child.error.message);
  process.exitCode = 1;
}
