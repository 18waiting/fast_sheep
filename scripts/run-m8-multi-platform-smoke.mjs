// M8 multi-platform smoke (clean-room). Six synthetic sessions coexist; partitions
// differ; inbound never cross-routes; dispose isolated; 0 external network.
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

const resultFile = join(mkdtempSync(join(tmpdir(), "m8-multi-")), "multi.json");
const child = spawn(electronPath, [MAIN_ENTRY], {
  cwd: ROOT,
  env: { ...process.env, FASTWORK_DESKTOP_TEST_MODE: "1", FASTWORK_DESKTOP_M8_MULTI_RESULT_FILE: resultFile, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (d) => { stderr += String(d); });
const timeout = setTimeout(() => { console.error("FAIL: multi-platform smoke timed out"); child.kill(); process.exit(1); }, 120000);
child.on("exit", () => {
  clearTimeout(timeout);
  if (!existsSync(resultFile)) { console.error("FAIL: no multi-platform result; stderr: " + stderr.slice(0, 1500)); process.exit(1); }
  const r = JSON.parse(readFileSync(resultFile, "utf-8"));
  const checks = [
    ["sessions_coexist", r.sessions_coexist === true],
    ["partitions_unique", r.partitions_unique === true],
    ["inbound_no_cross_route", r.inbound_no_cross_route === true],
    ["dispose_isolated", r.dispose_isolated === true],
    ["external_network_calls", r.external_network_calls === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [n, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + "multi " + n);
  const report = { platforms: r.platforms ?? [], ...r, all_passed: failed.length === 0 && r.result === "PASS" };
  writeFileSync(join(ROOT, "reports", "m8-multi-platform-isolation-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  rmSync(dirname(resultFile), { recursive: true, force: true });
  if (failed.length > 0 || r.result !== "PASS") { console.error("M8 multi-platform smoke FAILED: " + failed.map(([n]) => n).join(", ")); process.exit(1); }
  console.log("M8 multi-platform smoke PASS.");
});
