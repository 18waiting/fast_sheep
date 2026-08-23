// M12 final golden execution (clean-room). Discovers every frozen fixture from disk,
// routes each family to its actual production clean-room harness (existing verify
// scripts / golden runners), and assembles the full golden report.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FIXTURES = join(ROOT, "..", "parity-tests", "fixtures");
const REPORTS = join(ROOT, "reports");

const FAMILY_RUNNERS = {
  RPC: { script: "verify-m2-rpc-goldens.mjs", report: "m2-parity-report.json" },
  RAG: { script: "verify-m3-rag-goldens.mjs", report: "m3-parity-report.json" },
  PROMPT: { script: "verify-m4-prompt-goldens.mjs", report: "m4-prompt-fixture-results.json" },
  TOOL: { script: "verify-m4-tool-goldens.mjs", report: "m4-tool-fixture-results.json" },
  PROV: { script: "verify-m4-provider-goldens.mjs", report: "m4-provider-fixture-results.json" },
  SEC: { script: "verify-m4-security-goldens.mjs", report: "m4-security-fixture-results.json" },
  CONV: { script: "verify-m5-conversation-goldens.mjs", report: "m5-conversation-fixture-results.json" },
  ORCH: { script: "verify-m5-orchestrator-goldens.mjs", report: "m5-orchestrator-fixture-results.json" },
  PDD: { script: "verify-m7-pdd-goldens.mjs", report: "m7-platform-parity-report.json" },
  PLAT: { script: "verify-m8-platform-goldens.mjs", report: "m8-platform-parity-report.json" },
  HANDOFF: { script: "verify-m9-handoff-goldens.mjs", report: "m9-handoff-test-report.json" },
  FB: { script: "verify-m9-feedback-goldens.mjs", report: "m9-feedback-test-report.json" },
  LEARN: { script: "verify-m10-learning-goldens.mjs", report: "m10-learning-test-report.json" },
  REV: { script: "verify-m10-review-goldens.mjs", report: "m10-review-test-report.json" },
  AUDIT: { script: "verify-m10-audit-goldens.mjs", report: "m10-audit-test-report.json" },
  OPT: { script: "verify-m10-optimization-goldens.mjs", report: "m10-optimization-test-report.json" },
  STORE: { script: "verify-m11-store-goldens.mjs", report: "m11-store-parity-report.json" },
};

// 1) Discover fixtures from disk.
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}
const fixtures = [];
const legacyInputs = [];
for (const p of walk(FIXTURES)) {
  let fx;
  try { fx = JSON.parse(readFileSync(p, "utf-8")); } catch { legacyInputs.push(p); continue; }
  if (!fx || typeof fx.case_id !== "string" || !fx.case_id.startsWith("GF-")) continue;
  const family = fx.case_id.slice(3).split("-")[0];
  fixtures.push({
    case_id: fx.case_id, family, behavior_ids: fx.behavior_ids ?? [], test_class: fx.test_class ?? "",
    parity_level: fx.parity_level ?? "", comparison_mode: (fx.comparison ?? {}).mode ?? "",
    path: p.slice(ROOT.length + 1),
  });
}

// Special-case runners for security fixtures owned by other gates.
const SPECIAL_RUNNERS = {
  "GF-SEC-007": "check-rpc-no-listener.mjs",
  "GF-SEC-008": "check-m11-import-secret-safety.mjs",
};

// 2) Run each family harness and read per-case results.
const resultByCase = new Map();
const unowned = [];
for (const fx of fixtures) {
  const special = SPECIAL_RUNNERS[fx.case_id];
  if (special) {
    try {
      execFileSync("node", [join("scripts", special)], { encoding: "utf-8", cwd: ROOT });
      resultByCase.set(fx.case_id, { result: "PASS", runner: special, notes: "P3 security gate" });
    } catch {
      resultByCase.set(fx.case_id, { result: "FAIL", runner: special, notes: "security gate failed" });
    }
  }
}
for (const family of [...new Set(fixtures.map((f) => f.family))]) {
  const runner = FAMILY_RUNNERS[family];
  if (family === "JOB") {
    // DESIGN_CONFORMANCE: executed by the @fastwork/background-jobs test suite.
    try {
      execFileSync("node", ["--test", "packages/background-jobs/tests/*.test.ts"], { encoding: "utf-8", cwd: ROOT });
      for (const f of fixtures.filter((x) => x.family === "JOB")) resultByCase.set(f.case_id, { result: "PASS", runner: "background-jobs-tests", notes: "DESIGN_CONFORMANCE executed by @fastwork/background-jobs suite" });
    } catch { for (const f of fixtures.filter((x) => x.family === "JOB")) resultByCase.set(f.case_id, { result: "FAIL", runner: "background-jobs-tests", notes: "suite failed" }); }
    continue;
  }
  if (!runner) { unowned.push(...fixtures.filter((f) => f.family === family).map((f) => f.case_id)); continue; }
  try {
    execFileSync("node", [join("scripts", runner.script)], { encoding: "utf-8", cwd: ROOT });
  } catch (e) {
    console.error("harness failed for " + family + ": " + String(e.message));
  }
  const reportPath = join(REPORTS, runner.report);
  if (!existsSync(reportPath)) { unowned.push(...fixtures.filter((f) => f.family === family).map((f) => f.case_id)); continue; }
  const report = JSON.parse(readFileSync(reportPath, "utf-8"));
  const cases = report.cases ?? report.results ?? [];
  const notesByCase = new Map((report.notes ?? []).map((n) => [n.case_id, n.notes]));
  for (const c of cases) {
    const res = c.result ?? c.status ?? (c.executed === true ? "PASS" : "NOT_APPLICABLE");
    resultByCase.set(c.case_id, { result: res, runner: runner.script, notes: notesByCase.get(c.case_id) ?? c.notes ?? "" });
  }
}

// 3) Assemble the full golden report.
const records = fixtures.map((f) => {
  const r = resultByCase.get(f.case_id);
  return {
    case_id: f.case_id, family: f.family, behavior_ids: f.behavior_ids, test_class: f.test_class,
    parity_level: f.parity_level, runner: r?.runner ?? "UNOWNED", comparison_mode: f.comparison_mode,
    executed: r ? true : false, result: r?.result ?? "NOT_APPLICABLE", notes: r?.notes ?? (r ? "" : "no execution owner"),
  };
});
const counts = { discovered: records.length, executed: records.filter((r) => r.executed).length, passed: records.filter((r) => r.result === "PASS").length, failed: records.filter((r) => r.result === "FAIL").length, not_applicable: records.filter((r) => r.result === "NOT_APPLICABLE").length };
const failedCaseIds = records.filter((r) => r.result === "FAIL").map((r) => r.case_id);
const unownedCaseIds = records.filter((r) => r.runner === "UNOWNED").map((r) => r.case_id);
const fullGolden = { milestone: "M12", ...counts, failed_case_ids: failedCaseIds, unowned_case_ids: unownedCaseIds, cases: records, all_passed: counts.failed === 0 && counts.not_applicable === 0 && unownedCaseIds.length === 0 };
writeFileSync(join(REPORTS, "m12-full-golden-report.json"), JSON.stringify(fullGolden, null, 2) + "\n", "utf-8");

// 4) Fixture inventory report.
const byParity = {};
for (const f of fixtures) byParity[f.parity_level] = (byParity[f.parity_level] ?? 0) + 1;
const byTestClass = {};
for (const f of fixtures) byTestClass[f.test_class] = (byTestClass[f.test_class] ?? 0) + 1;
const byFamily = {};
for (const f of fixtures) byFamily[f.family] = (byFamily[f.family] ?? 0) + 1;
writeFileSync(join(REPORTS, "m12-fixture-inventory-report.json"), JSON.stringify({
  milestone: "M12", total: fixtures.length, historical_baseline: 222, drift: fixtures.length - 222,
  by_parity: byParity, by_test_class: byTestClass, by_family: byFamily,
  legacy_test_inputs: legacyInputs.length, result: fixtures.length === 222 ? "PASS" : "DRIFT",
}, null, 2) + "\n", "utf-8");

if (fullGolden.all_passed !== true || counts.failed > 0 || unownedCaseIds.length > 0) {
  console.error("M12 full golden FAILED: failed=" + failedCaseIds.join(",") + " unowned=" + unownedCaseIds.join(","));
  process.exit(1);
}
console.log("M12 full golden PASS (" + counts.passed + "/" + counts.discovered + ").");
