import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertProofRoot, proofRootForRepo } from "./fixtures/sheep-301-local-electron-websocket-boundary/path-policy.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const MAIN_PATH = join(HERE, "fixtures", "sheep-301-local-electron-websocket-boundary", "main.mjs");
const PROOF_ROOT = assertProofRoot(REPO_ROOT, process.env.SHEEP301_PROOF_ROOT ?? proofRootForRepo(REPO_ROOT));
const desktopRequire = createRequire(join(REPO_ROOT, "apps", "desktop", "package.json"));

const regressionFiles = [
  join(HERE, "fixtures", "sheep-301-local-electron-websocket-boundary", "path-policy.test.mjs"),
  join(HERE, "fixtures", "sheep-301-local-electron-websocket-boundary", "observer-lifecycle.test.mjs"),
];
const regression = spawnSync(process.execPath, ["--test", ...regressionFiles], { cwd: REPO_ROOT, stdio: "inherit", windowsHide: true });
if (regression.error) { console.error("SHEEP-301 proof regression launch failed: " + regression.error.message); process.exit(1); }
if (regression.status !== 0) { console.error("SHEEP-301 proof regressions failed"); process.exit(regression.status ?? 1); }

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
  env: {
    ...process.env,
    SHEEP301_PROOF_LAUNCHER: fileURLToPath(import.meta.url),
    SHEEP301_PROOF_ROOT: PROOF_ROOT.resolvedCandidate,
  },
});
child.on("error", (error) => { console.error("SHEEP-301 proof launch failed: " + error.message); process.exit(1); });
child.on("exit", (code, signal) => {
  if (signal) { console.error("SHEEP-301 proof terminated by signal " + signal); process.exit(1); }
  process.exit(code ?? 1);
});
