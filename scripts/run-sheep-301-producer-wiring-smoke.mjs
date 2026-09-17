import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const PROOF_ROOT = resolve(REPO_ROOT, ".tmp", "sheep-301-producer-wiring");
const MAIN_PATH = join(HERE, "fixtures", "sheep-301-producer-wiring", "main.mjs");

function validateRoot(candidate) {
  const resolvedCandidate = resolve(candidate);
  const rel = relative(REPO_ROOT, resolvedCandidate);
  const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  return { ok: inside && resolvedCandidate === PROOF_ROOT, reason: inside ? (resolvedCandidate === PROOF_ROOT ? "OK" : "NOT_EXACT_PROOF_ROOT") : "PATH_OUTSIDE_REPO", resolvedCandidate, expected: PROOF_ROOT, relativeToRepo: rel };
}
const pathCheck = validateRoot(PROOF_ROOT);
const siblingCheck = validateRoot(resolve(REPO_ROOT, "..", basename(REPO_ROOT) + ".tmp", "sheep-301-producer-wiring"));
const escapeCheck = validateRoot(resolve(REPO_ROOT, ".tmp", "..", "escape"));
if (!pathCheck.ok || siblingCheck.ok || escapeCheck.ok) {
  throw new Error("producer wiring smoke path validation failed: " + JSON.stringify({ pathCheck, siblingCheck, escapeCheck }));
}

const regressionFiles = [
  join(REPO_ROOT, "apps", "desktop", "tests", "pdd-main-admission.test.ts"),
  join(REPO_ROOT, "apps", "desktop", "tests", "pdd-inbound-observer.test.ts"),
  join(REPO_ROOT, "apps", "desktop", "tests", "bootstrap-pdd-ingress-wiring.test.ts"),
  join(REPO_ROOT, "apps", "desktop", "tests", "pdd-platform-service.test.ts"),
  join(REPO_ROOT, "apps", "desktop", "tests", "pdd-page-ipc-guard.test.ts"),
];
const regression = spawnSync(process.execPath, ["--test", ...regressionFiles], { cwd: REPO_ROOT, stdio: "inherit", windowsHide: true });
if (regression.error) throw regression.error;
if (regression.status !== 0) process.exit(regression.status ?? 1);

const desktopRequire = createRequire(join(REPO_ROOT, "apps", "desktop", "package.json"));
const electronPath = desktopRequire("electron");
if (typeof electronPath !== "string" || electronPath.length === 0) throw new Error("Electron executable path missing");
const child = spawn(electronPath, ["--disable-gpu", MAIN_PATH], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, SHEEP301_PRODUCER_WIRING_ROOT: PROOF_ROOT, SHEEP301_REPO_ROOT: REPO_ROOT, SHEEP301_UNIT_TESTS_PASSED: "1" },
});
child.on("error", (error) => { console.error("producer wiring smoke launch failed: " + error.message); process.exit(1); });
child.on("exit", (code, signal) => {
  if (signal) { console.error("producer wiring smoke terminated by signal " + signal); process.exit(1); }
  process.exit(code ?? 1);
});
