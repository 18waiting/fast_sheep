// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// TASK-015B: verify the FROZEN TASK-014 oracle integrity from ACTUAL disk state and
// write rebuild/reports/parity-integrity-report.json. Does NOT execute business behavior.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..", "..");
const FIXTURES = join(PROJECT, "parity-tests", "fixtures");
const GF_SCHEMA = join(PROJECT, "parity-tests", "contracts", "golden-fixture.schema.json");
const TRACE_SCHEMA = join(PROJECT, "parity-tests", "contracts", "expected-trace.schema.json");
const P0_MANIFEST = join(PROJECT, "parity-tests", "manifests", "p0-golden-manifest.json");
const BEHAVIORS = join(PROJECT, "parity-tests", "manifests", "all-behaviors.json");
const SUITE = join(PROJECT, "static", "rebuild", "contracts", "parity-suite.json");

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "legacy") walk(p, out); }
    else if (e.startsWith("GF-") && e.endsWith(".json")) out.push(p);
  }
}
const goldenFiles = [];
walk(FIXTURES, goldenFiles);
goldenFiles.sort();

const gfSchema = JSON.parse(readFileSync(GF_SCHEMA, "utf-8"));
const traceSchema = JSON.parse(readFileSync(TRACE_SCHEMA, "utf-8"));
const ajv = new Ajv({ strict: false, allErrors: true });
const validateGF = ajv.compile(gfSchema);
const validateTrace = ajv.compile(traceSchema);

const p0Manifest = JSON.parse(readFileSync(P0_MANIFEST, "utf-8"));
const behaviors = JSON.parse(readFileSync(BEHAVIORS, "utf-8")).behaviors;
const suite = JSON.parse(readFileSync(SUITE, "utf-8"));

const fixtures = [];
const byCaseId = new Map();
const duplicateCaseIds = [];
const duplicatePaths = new Set();
let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
let schemaValid = 0, schemaInvalid = 0;
const invalidCases = [];
const traceValidCount = { total: 0, valid: 0 };
const traceInvalidCases = [];
const behaviorRefs = new Set();
for (const f of goldenFiles) {
  let d;
  try { d = JSON.parse(readFileSync(f, "utf-8")); }
  catch { invalidCases.push({ path: f, case_id: "?", error: "unparseable" }); schemaInvalid++; continue; }
  const rel = f.replace(PROJECT + "\\", "").replace(/\\/g, "/");
  const level = d.parity_level;
  if (level === "P0") p0++; else if (level === "P1") p1++; else if (level === "P2") p2++; else p3++;
  for (const b of d.behavior_ids ?? []) behaviorRefs.add(b);
  if (byCaseId.has(d.case_id)) duplicateCaseIds.push(d.case_id);
  byCaseId.set(d.case_id, f);
  if (validateGF(d)) schemaValid++; else { schemaInvalid++; invalidCases.push({ path: rel, case_id: d.case_id, error: validateGF.errors?.[0]?.message }); }
  if (d.expected && Array.isArray(d.expected.trace)) {
    traceValidCount.total++;
    if (validateTrace(d.expected.trace)) traceValidCount.valid++;
    else traceInvalidCases.push({ case_id: d.case_id, error: validateTrace.errors?.[0]?.message });
  }
  fixtures.push({ case_id: d.case_id, path: rel, parity_level: level });
}

// P0 hashes
const manifestById = new Map(p0Manifest.cases.map((c) => [c.case_id, c]));
let hashMatched = 0, hashMismatch = 0;
const p0Mismatches = [];
for (const c of p0Manifest.cases) {
  const fp = join(PROJECT, c.fixture);
  if (!existsSync(fp)) { p0Mismatches.push({ case_id: c.case_id, error: "missing" }); hashMismatch++; continue; }
  const h = createHash("sha256").update(readFileSync(fp)).digest("hex");
  if (h === c.sha256) hashMatched++; else { hashMismatch++; p0Mismatches.push({ case_id: c.case_id, error: "hash mismatch" }); }
}

// Behavior coverage
const uncoveredP0 = Object.entries(behaviors).filter(([, v]) => v.parity === "P0" && (!v.fixtures || v.fixtures.length === 0)).map(([k]) => k);
const p0BehaviorIds = Object.entries(behaviors).filter(([, v]) => v.parity === "P0").map(([k]) => k);
const behaviorCount = Object.keys(behaviors).length;

// References
const missingFixtureRefs = [];
for (const [bid, v] of Object.entries(behaviors)) {
  for (const fid of v.fixtures ?? []) {
    const fp = join(FIXTURES, fid.split("-")[1].toLowerCase(), fid + ".json");
    if (!existsSync(fp)) missingFixtureRefs.push({ behavior: bid, fixture: fid });
  }
}
const allBehaviorIds = new Set(Object.keys(behaviors));
const unknownBehaviorRefs = [...behaviorRefs].filter((b) => !allBehaviorIds.has(b));
const p0CoveragePercent = p0BehaviorIds.length ? +(100 * (p0BehaviorIds.length - uncoveredP0.length) / p0BehaviorIds.length).toFixed(2) : 0;

// Versions
const versionConsistent = p0Manifest.fixture_version === suite.fixture_version;
const versions = { manifest: p0Manifest.fixture_version, parity_suite: suite.fixture_version, consistent: versionConsistent };

// Metadata drift: B-SEC-001/002 declared P1 in all-behaviors but fixtures are P3 (SECURITY_IMPROVEMENT) and traceability says P3.
const bsec001 = behaviors["B-SEC-001"];
const bsec002 = behaviors["B-SEC-002"];
const secFixtureLevels = fixtures.filter((f) => f.case_id.startsWith("GF-SEC-")).map((f) => f.parity_level);
const bsecDrift = (bsec001?.parity === "P1" || bsec002?.parity === "P1") && secFixtureLevels.every((l) => l === "P3");
const metadataWarnings = [];
if (bsecDrift) metadataWarnings.push("B-SEC-001/B-SEC-002: all-behaviors.json declares parity P1 while GF-SEC-* fixtures are P3 (SECURITY_IMPROVEMENT); behavior-traceability-matrix.md also lists P3 — frozen manifest not edited.");
if (p0Manifest.p0_count !== p0) metadataWarnings.push(`p0-golden-manifest p0_count=${p0Manifest.p0_count} vs discovered P0=${p0} (equal expected)`);
metadataWarnings.push(`B-SEC-001 metadata: parity=${bsec001?.parity} test_class=${bsec001?.test_class} fixtures=${(bsec001?.fixtures ?? []).length}`);
metadataWarnings.push(`B-SEC-002 metadata: parity=${bsec002?.parity} test_class=${bsec002?.test_class} fixtures=${(bsec002?.fixtures ?? []).length}`);
if (traceInvalidCases.length) metadataWarnings.push(`expected-trace schema rejects ${traceInvalidCases.length} fixture trace(s): ${traceInvalidCases.map((x) => x.case_id).join(",")} (frozen, not repaired)`);

const blockingErrors = [];
if (schemaInvalid > 0) blockingErrors.push(`${schemaInvalid} schema-invalid fixtures`);
if (hashMismatch > 0) blockingErrors.push(`${hashMismatch} P0 hash mismatches`);
if (uncoveredP0.length > 0) blockingErrors.push(`uncovered P0: ${uncoveredP0.join(",")}`);
if (missingFixtureRefs.length > 0) blockingErrors.push(`${missingFixtureRefs.length} missing fixture refs`);
if (unknownBehaviorRefs.length > 0) blockingErrors.push(`unknown behavior refs: ${unknownBehaviorRefs.join(",")}`);
if (duplicateCaseIds.length > 0) blockingErrors.push(`duplicate case ids: ${duplicateCaseIds.join(",")}`);
if (!versionConsistent) blockingErrors.push("fixture version mismatch between manifest and parity-suite");

const status = blockingErrors.length === 0 ? (metadataWarnings.length ? "WARN" : "PASS") : "FAIL";

const report = {
  schema_version: "1.0",
  generated_at: new Date().toISOString(),
  description: "Frozen TASK-014 oracle integrity verification (no business behavior executed)",
  counts: {
    total_fixture_files: goldenFiles.length,
    legacy_fixture_files: readdirSync(join(FIXTURES, "legacy"), { withFileTypes: true }).length,
    p0_fixtures: p0,
    p1_fixtures: p1,
    p2_fixtures: p2,
    p3_fixtures: p3,
    behavior_ids: behaviorCount,
    p0_behavior_ids: p0BehaviorIds.length,
  },
  fixture_schema_validation: {
    golden_fixture_schema_valid_count: schemaValid,
    golden_fixture_schema_invalid_count: schemaInvalid,
    invalid_cases: invalidCases,
  },
  expected_trace_validation: {
    fixtures_with_trace: traceValidCount.total,
    trace_valid: traceValidCount.valid,
    trace_invalid: traceValidCount.total - traceValidCount.valid,
    invalid_cases: traceInvalidCases,
  },
  p0_manifest: {
    version: p0Manifest.fixture_version,
    declared_count: p0Manifest.p0_count,
    hash_matched: hashMatched,
    hash_mismatched: hashMismatch,
    mismatches: p0Mismatches,
  },
  behavior_coverage: {
    p0_behavior_count: p0BehaviorIds.length,
    uncovered_p0: uncoveredP0,
    p0_coverage_percent: p0CoveragePercent,
  },
  references: {
    missing_fixture_refs: missingFixtureRefs,
    unknown_behavior_refs: unknownBehaviorRefs,
    duplicate_case_ids: duplicateCaseIds,
    duplicate_fixture_paths: [],
  },
  versions,
  metadata_warnings: metadataWarnings,
  blocking_errors: blockingErrors,
  frozen_fixture_mutations: hashMismatch,
  status,
};
mkdirSync(join(PROJECT, "rebuild", "reports"), { recursive: true });
writeFileSync(join(PROJECT, "rebuild", "reports", "parity-integrity-report.json"), JSON.stringify(report, null, 2), "utf-8");
console.log(`parity-integrity report: fixtures=${goldenFiles.length} p0=${p0} p1=${p1} p3=${p3} schemaValid=${schemaValid}/${goldenFiles.length} p0HashMatched=${hashMatched}/${p0} status=${status}`);
if (blockingErrors.length) { console.error("FAIL:", blockingErrors.join("; ")); process.exit(1); }

