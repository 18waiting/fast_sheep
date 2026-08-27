// SHEEP-044 visual evidence launcher (Node). Spawns Electron with the capture-main
// stub (evidence tooling only) and resolves the electron binary from the desktop
// package, mirroring run-m6-electron-smoke.mjs.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const require = createRequire(join(ROOT, "apps", "desktop", "package.json"));
const electronPath = require("electron");
const gallery = process.argv.includes("--gallery");
const states = process.argv.includes("--states");
const focus = process.argv.includes("--focus");
const queue = process.argv.includes("--queue");
const queueEmpty = process.argv.includes("--queue-empty");
const CAPTURE_MAIN = queue || queueEmpty
  ? join(HERE, "visual-evidence", "capture-queue-main.mjs")
  : join(HERE, "visual-evidence", "capture-main.cjs");
const MAIN_ENTRY = join(ROOT, "apps", "desktop", "dist", "main", "index.js");

if (!existsSync(MAIN_ENTRY)) {
  console.error("FAIL: desktop not built: " + MAIN_ENTRY);
  console.error("Run: pnpm --filter @fastwork/desktop run build");
  process.exit(1);
}

const child = spawn(electronPath, [CAPTURE_MAIN], {
  cwd: ROOT,
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true", FS_VISUAL_TARGET: queue || queueEmpty ? "queue" : focus ? "focus" : states ? "states" : gallery ? "gallery" : "workbench", FS_VISUAL_QUEUE_SEED: queue ? "1" : "0", FASTWORK_DESKTOP_TEST_MODE: queue || queueEmpty ? "1" : "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (d) => { stderr += String(d); });
const timeout = setTimeout(() => { console.error("FAIL: visual capture timed out after 60s"); child.kill(); process.exit(1); }, 60000);

child.on("exit", (code) => {
  clearTimeout(timeout);
  const out = join(ROOT, "reports", "visual-evidence", queue ? "sheep-060-queue-populated.png" : queueEmpty ? "sheep-060-queue-empty.png" : focus ? "sheep-047-a11y-focus-gallery.png" : states ? "sheep-046-state-gallery.png" : gallery ? "sheep-045-primitive-gallery.png" : "sheep-047-workbench.png");
  if (!existsSync(out)) {
    console.error("FAIL: no visual captured. exit=" + code);
    if (stderr) console.error(stderr.slice(0, 4000));
    process.exit(1);
  }
  console.log("VISUAL_EVIDENCE " + out);
  console.log("Visual capture PASS.");
});
child.on("error", (e) => { clearTimeout(timeout); console.error("FAIL: cannot spawn electron: " + e.message); process.exit(1); });