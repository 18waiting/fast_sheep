// M12 behavior coverage check (clean-room). Every behavior in the frozen
// all-behaviors manifest must map to at least one passing executable fixture.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PARITY = join(ROOT, "..", "parity-tests");
const REPORTS = join(ROOT, "reports");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

const behaviors = JSON.parse(readFileSync(join(PARITY, "manifests", "all-behaviors.json"), "utf-8")).behaviors;
const golden = JSON.parse(readFileSync(join(REPORTS, "m12-full-golden-report.json"), "utf-8"));
const resultByCase = new Map(golden.cases.map((c) => [c.case_id, c.result]));

const priorityCounts = {};
for (const b of Object.values(behaviors)) priorityCounts[b.parity] = (priorityCounts[b.parity] ?? 0) + 1;

const covered = new Set();
const uncovered = [];
for (const [bid, b] of Object.entries(behaviors)) {
  const fixtures = b.fixtures ?? [];
  const passing = fixtures.filter((f) => resultByCase.get(f) === "PASS");
  if (passing.length > 0) covered.add(bid);
  else uncovered.push(bid);
}
check(uncovered.length === 0, "all behaviors covered by passing fixtures (uncovered=" + uncovered.join(",") + ")");

const p0Bids = Object.entries(behaviors).filter(([, b]) => b.parity === "P0").map(([k]) => k);
const p0Covered = p0Bids.filter((b) => covered.has(b)).length;
const p1Bids = Object.entries(behaviors).filter(([, b]) => b.parity === "P1").map(([k]) => k);
const p1Passed = p1Bids.filter((b) => covered.has(b)).length;
check(p0Covered === p0Bids.length, "P0 behavior coverage 100% (" + p0Covered + "/" + p0Bids.length + ")");

const report = {
  milestone: "M12",
  behavior_total: Object.keys(behaviors).length,
  priority_counts: priorityCounts,
  p0_total: p0Bids.length,
  p0_covered: p0Covered,
  p0_passed: p0Covered,
  p0_coverage_percent: Math.round((p0Covered / p0Bids.length) * 100),
  p1_total: p1Bids.length,
  p1_passed: p1Passed,
  p3_total: 0,
  p3_passed: 0,
  unmapped: uncovered,
  unexecuted: [],
  failed: golden.failed,
  result: uncovered.length === 0 && p0Covered === p0Bids.length ? "PASS" : "FAIL",
};
writeFileSync(join(REPORTS, "m12-behavior-coverage-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (report.result !== "PASS") { console.error("M12 behavior coverage FAILED"); process.exit(1); }
console.log("M12 behavior coverage PASS (" + p0Covered + "/" + p0Bids.length + " P0).");
