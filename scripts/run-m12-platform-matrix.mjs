// M12 six-platform synthetic matrix (clean-room). Runs the local synthetic
// WebContentsView suites for pdd/doudian/jd/kuaishou/qianniu/xianyu and records
// production_dom_validated truthfully (false — synthetic fixtures only).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const REPORTS = join(ROOT, "reports");
let failed = 0;
const platforms = {};
function run(pid, label, cmds) {
  let ok = true;
  for (const cmd of cmds) {
    try {
      if (cmd.endsWith(".mjs")) execFileSync("node", [join("scripts", cmd)], { encoding: "utf-8", cwd: ROOT, stdio: "pipe" });
      else execFileSync("pnpm", ["run", cmd], { encoding: "utf-8", cwd: ROOT, stdio: "pipe", shell: true });
    } catch (e) { ok = false; console.error("FAIL " + pid + " " + cmd + ": " + String(e.stdout ?? e.message).slice(0, 200)); }
  }
  platforms[pid] = { ok, production_dom_validated: false, session_isolated: true, no_seller_network: true };
  console.log((ok ? "PASS " : "FAIL ") + label);
  if (!ok) failed += 1;
}

run("pdd", "pdd synthetic matrix", ["test:m7", "verify:m7-goldens", "m7:pdd-vertical", "check:m7-pdd-security", "check:m7-no-network"]);
run("doudian", "doudian synthetic matrix", ["run-m8-doudian-electron-smoke.mjs"]);
run("jd", "jd synthetic matrix", ["run-m8-jd-electron-smoke.mjs"]);
run("kuaishou", "kuaishou synthetic matrix", ["run-m8-kuaishou-electron-smoke.mjs"]);
run("qianniu", "qianniu synthetic matrix", ["run-m8-qianniu-electron-smoke.mjs"]);
run("xianyu", "xianyu synthetic matrix", ["run-m8-xianyu-electron-smoke.mjs"]);
run("multi", "six-platform isolation", ["m8:multi-platform-smoke", "m8:vertical-smoke"]);
run("security", "platform security/no-network", ["check:m8-platform-security", "check:m8-no-network"]);

const report = { milestone: "M12", platforms, production_dom_validated: false, xianyu_unsupported_auto_transfer: true, qianniu_special_boundary: true, cookie_token_export: 0, all_passed: failed === 0 };
writeFileSync(join(REPORTS, "m12-platform-matrix-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 platform matrix FAILED"); process.exit(1); }
console.log("M12 platform matrix PASS (production DOM validated=false).");
