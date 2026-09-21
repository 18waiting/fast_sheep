// SHEEP-301 controlled REAL receive -> isolated DB -> Fast Sheep UI: launcher (Node).
//
// Spawns Electron with the env-gated Main entry. Two modes:
//   node scripts/run-sheep-301-real-app-capture.mjs --dry-run
//       local fixture page instead of the shop: verifies the wiring locally (no real page, no shop).
//   node scripts/run-sheep-301-real-app-capture.mjs --labels FS-...,FS-...,FS-...
//       the authorized real page (ONE controlled page startup), passive observation afterwards.
//
// All run artifacts stay under REPO_ROOT/.tmp. Nothing here touches credentials or the production DB.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const require = createRequire(join(ROOT, "apps", "desktop", "package.json"));
const electronPath = require("electron");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const labelsArg = args.find((value) => value.startsWith("--labels=")) ?? (args.includes("--labels") ? "--labels=" + String(args[args.indexOf("--labels") + 1] ?? "") : null);
const labels = (process.env.FS_SHEEP301_REAL_LABELS ?? (labelsArg ? labelsArg.slice("--labels=".length) : "") ?? "").trim();
const REUSE_REQUEST = (args.find((value) => value.startsWith("--reuse-target=")) ?? "").slice("--reuse-target=".length)
  || (args.includes("--reuse-target") ? String(args[args.indexOf("--reuse-target") + 1] ?? "") : "")
  || (process.env.FASTWORK_SHEEP301_REAL_REUSE_TARGET_ID ?? "");

const RUN_ID = process.env.FS_SHEEP301_REAL_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const RUN_ROOT = join(ROOT, ".tmp", "sheep-301-real-app", RUN_ID);
const ENTRY = join(ROOT, "apps", "desktop", "dist", "main", "controlled", "real-app-capture-main.js");
const RESULT_FILE = join(RUN_ROOT, "real-app-capture-result.json");
const SCREENSHOT = join(RUN_ROOT, "real-app-ui.png");
const STATUS_FILE = join(RUN_ROOT, "status.json");

if (!existsSync(ENTRY)) {
  console.error("FAIL: desktop not built: " + ENTRY);
  console.error("Run: pnpm --filter @fastwork/desktop run build");
  process.exit(1);
}
// RUNNER POLICY (Controller close-out correction): rebinding an EXISTING target is refused until a
// recovery design for "same target after termination" is reviewed and accepted. The approved
// constraint (R3C_TERMINAL_WEBCONTENTS_LIFECYCLE_CONSTRAINT) is written against the WebContents
// lifecycle and does not cover a cross-process rebind of an external CDP target.
if (REUSE_REQUEST.trim().length > 0) {
  console.error("REFUSED: reuse of an existing target is not authorized (requested target id: " + REUSE_REQUEST.trim() + ")");
  console.error("reason=REUSE_TARGET_REFUSED_UNTIL_RECOVERY_DESIGN_ACCEPTED");
  console.error("approved_constraint=R3C_TERMINAL_WEBCONTENTS_LIFECYCLE_CONSTRAINT");
  console.error("page_actions=0 electron_spawned=false");
  process.exit(4);
}
if (!dryRun && labels.length === 0) {
  console.error("FAIL: real mode requires three labels (--labels A,B,C or FS_SHEEP301_REAL_LABELS)");
  process.exit(1);
}
mkdirSync(RUN_ROOT, { recursive: true });
console.log("SHEEP-301 real-app capture run root: " + RUN_ROOT + (dryRun ? " (dry-run)" : " (REAL PAGE)"));

const DEFAULT_LABELS = "FS-DRYRUN-APP-1,FS-DRYRUN-APP-2,FS-DRYRUN-APP-3";
const env = {
  ...process.env,
  ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  FASTWORK_SHEEP301_REAL_MODE: dryRun ? "dry-run" : "real",
  FASTWORK_SHEEP301_REAL_LABELS: dryRun && labels.length === 0 ? DEFAULT_LABELS : labels,
  FASTWORK_SHEEP301_REAL_DATA_DIR: RUN_ROOT,
  FASTWORK_SHEEP301_REAL_RESULT_FILE: RESULT_FILE,
  FASTWORK_SHEEP301_REAL_SCREENSHOT: SCREENSHOT,
  FASTWORK_SHEEP301_REAL_STATUS_FILE: STATUS_FILE,
};
if (dryRun) env.FASTWORK_SHEEP301_REAL_STAGE_TIMEOUT_MS = process.env.FASTWORK_SHEEP301_REAL_STAGE_TIMEOUT_MS ?? "45000";
delete env.FASTWORK_DESKTOP_TEST_MODE;

const child = spawn(electronPath, [ENTRY], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", (data) => { process.stdout.write(data); });
child.stderr.on("data", (data) => { process.stderr.write(data); });
const windowMs = Number(env.FASTWORK_SHEEP301_REAL_TIMEOUT_MS ?? 1800000);
const timeout = setTimeout(() => {
  console.error("FAIL: real-app capture timed out after " + String(Math.round(windowMs / 1000)) + "s");
  child.kill();
  process.exit(1);
}, windowMs + 180000);

child.on("exit", (code) => {
  clearTimeout(timeout);
  if (code === 0 && existsSync(RESULT_FILE)) {
    console.log("RESULT " + RESULT_FILE);
    console.log("SCREENSHOT " + SCREENSHOT);
    console.log("Real-app capture PASS.");
    return;
  }
  if (code === 4 && existsSync(RESULT_FILE)) {
    console.error("REFUSED (expected): the runner refused a target rebind; no page action was taken (see " + RESULT_FILE + ")");
    process.exit(4);
  }
  if (code === 3 && existsSync(RESULT_FILE)) {
    console.error("PARTIAL: not all labels were captured (see " + RESULT_FILE + ")");
    process.exit(3);
  }
  console.error("FAIL: real-app capture exit=" + code + (existsSync(STATUS_FILE) ? " status=" + STATUS_FILE : ""));
  process.exit(1);
});
child.on("error", (error) => { clearTimeout(timeout); console.error("FAIL: cannot spawn electron: " + error.message); process.exit(1); });
