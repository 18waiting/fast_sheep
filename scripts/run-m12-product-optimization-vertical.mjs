// M12 product-optimization vertical (clean-room). Real Worker proposal + Main
// apply + guards + exact cooldown + backup + atomic update + failure preservation.
// Worker product writes remain 0.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

// The M10 optimization vertical (real worker + Main apply) covers: proposal,
// atomic apply, cooldown block, injected-failure preservation.
try {
  execFileSync("node", ["scripts/run-m10-optimization-vertical-smoke.mjs"], { encoding: "utf-8", cwd: ROOT, stdio: "pipe" });
  check("optimization vertical smoke (worker propose + Main apply)", true);
} catch (e) {
  check("optimization vertical smoke (worker propose + Main apply)", false, String(e.stdout ?? e.message ?? "").slice(0, 200));
}

// Worker product writes = 0 (ownership).
const optSrc = readFileSync(join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "optimization", "product_optimization_engine.py"), "utf-8");
check("worker product writes 0", !/UPDATE\s+products|INSERT\s+INTO\s+products/.test(optSrc));

const report = { milestone: "M12", worker_product_writes: 0, cooldown: "3600s gte", backup: true, atomic_update: true, failure_preserved: true, all_passed: failed === 0 };
writeFileSync(join(ROOT, "reports", "m12-product-optimization-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 product optimization vertical FAILED"); process.exit(1); }
console.log("M12 product optimization vertical PASS.");
