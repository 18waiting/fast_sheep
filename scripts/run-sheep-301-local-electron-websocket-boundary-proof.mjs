import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const MAIN_PATH = join(HERE, "fixtures", "sheep-301-local-electron-websocket-boundary", "main.mjs");
const desktopRequire = createRequire(join(REPO_ROOT, "apps", "desktop", "package.json"));

let electronPath;
try {
  electronPath = desktopRequire("electron");
  if (typeof electronPath !== "string" || electronPath.length === 0) throw new Error("electron executable path missing");
} catch (error) {
  console.error("SHEEP-301 proof cannot resolve Electron through apps/desktop dependencies: " + error.message);
  process.exit(1);
}

const child = spawn(electronPath, ["--disable-gpu", MAIN_PATH], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, SHEEP301_PROOF_LAUNCHER: fileURLToPath(import.meta.url) },
});
child.on("error", (error) => { console.error("SHEEP-301 proof launch failed: " + error.message); process.exit(1); });
child.on("exit", (code, signal) => {
  if (signal) { console.error("SHEEP-301 proof terminated by signal " + signal); process.exit(1); }
  process.exit(code ?? 1);
});
