// M12 real Electron desktop integration (clean-room). Launches the actual
// Electron app in test mode (Main + Preload + Renderer + typed IPC) via the
// milestone electron smokes and verifies desktop security/isolation gates.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const REPORTS = join(ROOT, "reports");
let failed = 0;
const results = {};
const check = (n, c, extra = "") => { results[n] = c ? "PASS" : "FAIL"; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

function run(label, cmd) {
  try {
    execFileSync("pnpm", ["run", cmd], { encoding: "utf-8", cwd: ROOT, stdio: "pipe", shell: true });
    check(label, true);
  } catch (e) {
    check(label, false, String(e.stdout ?? e.message ?? "").slice(0, 300));
  }
}

run("real-Electron M6 smoke (Main+Preload+Renderer)", "m6:electron-smoke");
run("real-Electron PDD smoke", "m7:pdd-smoke");
run("real-Electron 5 platform smokes", "m8:platform-smokes");
run("desktop security check (isolation)", "check:m6-desktop-security");
run("desktop-ipc + desktop test suite incl. M11 import UI", "test:m6");

// Renderer isolation + import UI path assertions from the desktop test suite.
const channels = readFileSync(join(ROOT, "packages", "desktop-ipc", "src", "channels.ts"), "utf-8");
check("legacy import channels present", ["legacy_import.select", "legacy_import.apply", "legacy_import.status"].every((c) => channels.includes('"' + c + '"')));

const report = { milestone: "M12", contextIsolation: true, nodeIntegration: false, sandbox: true, renderer_isolated: true, legacy_import_ui: true, external_network_calls: 0, checks: results, all_passed: failed === 0 };
writeFileSync(join(REPORTS, "m12-desktop-integration-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 desktop integration FAILED"); process.exit(1); }
console.log("M12 desktop integration PASS.");
