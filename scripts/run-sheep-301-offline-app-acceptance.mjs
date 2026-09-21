// SHEEP-301 controlled OFFLINE application acceptance launcher (Node).
// Spawns Electron with the env-gated Main entry (evidence tooling only) and resolves the electron
// binary from the desktop package, mirroring the other run-*.mjs launchers.
//
// Offline only: FASTWORK_DESKTOP_TEST_MODE=1 forces the FIXTURE navigation mode (no real PDD page,
// no network, no login state). All run artifacts stay under REPO_ROOT/.tmp.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const require = createRequire(join(ROOT, "apps", "desktop", "package.json"));
const electronPath = require("electron");

const RUN_ID = process.env.FS_SHEEP301_OFFLINE_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const RUN_ROOT = join(ROOT, ".tmp", "sheep-301-offline-app", RUN_ID);
const ENTRY = join(ROOT, "apps", "desktop", "dist", "main", "controlled", "offline-app-acceptance-main.js");
const RESULT_FILE = join(RUN_ROOT, "offline-app-acceptance-result.json");
const SCREENSHOT = join(RUN_ROOT, "offline-app-ui.png");

if (!existsSync(ENTRY)) {
  console.error("FAIL: desktop not built: " + ENTRY);
  console.error("Run: pnpm --filter @fastwork/desktop run build");
  process.exit(1);
}
if (process.argv.includes("--fresh") && process.env.FS_SHEEP301_OFFLINE_RUN_ID) {
  rmSync(RUN_ROOT, { recursive: true, force: true });
}
mkdirSync(RUN_ROOT, { recursive: true });

console.log("SHEEP-301 offline acceptance run root: " + RUN_ROOT);
const child = spawn(electronPath, [ENTRY], {
  cwd: ROOT,
  env: {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    FASTWORK_DESKTOP_TEST_MODE: "1",
    FASTWORK_SHEEP301_OFFLINE_DATA_DIR: RUN_ROOT,
    FASTWORK_SHEEP301_OFFLINE_RESULT_FILE: RESULT_FILE,
    FASTWORK_SHEEP301_OFFLINE_SCREENSHOT: SCREENSHOT,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (data) => { process.stdout.write(data); });
child.stderr.on("data", (data) => { process.stderr.write(data); });
const timeout = setTimeout(() => {
  console.error("FAIL: offline app acceptance timed out after 180s");
  child.kill();
  process.exit(1);
}, 180000);

child.on("exit", (code) => {
  clearTimeout(timeout);
  const ok = code === 0 && existsSync(RESULT_FILE) && existsSync(SCREENSHOT);
  if (!ok) {
    console.error("FAIL: offline app acceptance exit=" + code);
    process.exit(1);
  }
  console.log("RESULT " + RESULT_FILE);
  console.log("SCREENSHOT " + SCREENSHOT);
  console.log("Offline app acceptance PASS.");
});
child.on("error", (error) => { clearTimeout(timeout); console.error("FAIL: cannot spawn electron: " + error.message); process.exit(1); });
