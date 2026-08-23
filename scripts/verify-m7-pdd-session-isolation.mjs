// M7 PDD session isolation verification (clean-room). Real Electron test mode:
// two PDD shops, distinct partitions, independent conversations, no cross-shop
// message/send leak, view activation switching, no cookie export.
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

const resultFile = join(mkdtempSync(join(tmpdir(), "m7-isol-")), "isolation.json");
const child = spawn(electronPath, [MAIN_ENTRY], {
  cwd: ROOT,
  env: { ...process.env, FASTWORK_DESKTOP_TEST_MODE: "1", FASTWORK_DESKTOP_M7_ISOLATION_RESULT_FILE: resultFile, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
const timeout = setTimeout(() => { console.error("FAIL: isolation smoke timed out"); child.kill(); process.exit(1); }, 60000);
child.on("exit", () => {
  clearTimeout(timeout);
  if (!existsSync(resultFile)) { console.error("FAIL: no isolation result file"); process.exit(1); }
  const r = JSON.parse(readFileSync(resultFile, "utf-8"));
  const checks = [
    ["shops_tested", r.shops_tested === 2],
    ["partitions_unique", r.partitions_unique === true],
    ["state_machine", r.state_machine === true],
    ["shop_switch", r.shop_switch === true],
    ["cross_shop_message_leak", r.cross_shop_message_leak === true],
    ["cross_shop_send_leak", r.cross_shop_send_leak === true],
    ["session_reuse", r.session_reuse === true],
    ["manual_login_boundary", r.manual_login_boundary === true],
    ["external_network_calls", r.external_network_calls === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + "isolation " + name);
  const report = { ...r, all_passed: failed.length === 0 };
  writeFileSync(join(ROOT, "reports", "m7-pdd-session-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  rmSync(dirname(resultFile), { recursive: true, force: true });
  if (failed.length > 0 || r.result !== "PASS") { console.error("M7 session isolation FAILED: " + failed.map(([n]) => n).join(", ")); process.exit(1); }
  console.log("M7 PDD session isolation PASS.");
});
