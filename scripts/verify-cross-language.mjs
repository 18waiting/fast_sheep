// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// TASK-015B: run the cross-language corpus through the TypeScript (Ajv 2020) validator
// and the Python validator, then write rebuild/reports/cross-language-contract-report.json
// with REAL agreement numbers.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { compileAllSchemas } from "../packages/contracts/dist/validate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const CORPUS = join(REBUILD, "packages", "contracts", "testdata", "cross-language-cases.json");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

if (!existsSync(CORPUS)) {
  console.error("FAIL: cross-language corpus missing:", CORPUS);
  process.exit(1);
}
const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const { ajv } = compileAllSchemas();

// TypeScript validation
const tsResults = new Map();
for (const c of corpus.cases) {
  const v = ajv.getSchema(c.schema_id);
  if (!v) {
    tsResults.set(c.case_id, { valid: false, error: `unknown schema ${c.schema_id}` });
    continue;
  }
  const ok = v(c.payload);
  tsResults.set(c.case_id, { valid: ok, error: ok ? null : (v.errors?.[0]?.message ?? "invalid") });
}

// Python validation (run once, parse per-case lines)
let pythonLines = [];
try {
  const out = execFileSync("python", ["-m", "fastwork_ai_worker.contracts.validator", CORPUS], {
    env: { ...process.env, PYTHONPATH: WORKER_SRC },
    encoding: "utf-8",
  });
  pythonLines = out.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
} catch (e) {
  console.error("FAIL: python validator run error:", String(e.message ?? e));
  process.exit(1);
}
const pyResults = new Map();
for (const line of pythonLines) {
  const r = JSON.parse(line);
  pyResults.set(r.case_id, { valid: r.valid, error: (r.errors ?? []).slice(0, 1).join("; ") || null });
}

const cases = [];
let agreementCount = 0;
let expectedMatchCount = 0;
for (const c of corpus.cases) {
  const ts = tsResults.get(c.case_id) ?? { valid: false, error: "missing" };
  const py = pyResults.get(c.case_id) ?? { valid: false, error: "missing" };
  const agreement = ts.valid === py.valid;
  const expectedMatch = ts.valid === c.expected_valid && py.valid === c.expected_valid;
  if (agreement) agreementCount++;
  if (expectedMatch) expectedMatchCount++;
  cases.push({
    case_id: c.case_id,
    schema_id: c.schema_id,
    expected_valid: c.expected_valid,
    typescript_valid: ts.valid,
    python_valid: py.valid,
    agreement,
    typescript_error: ts.error,
    python_error: py.error,
  });
}
const total = cases.length;
const agreementPercent = total ? +(100 * agreementCount / total).toFixed(2) : 0;
const expectedMatchPercent = total ? +(100 * expectedMatchCount / total).toFixed(2) : 0;

let pyVersion = "unknown";
try { pyVersion = execFileSync("python", ["--version"], { encoding: "utf-8" }).trim(); } catch {}
const report = {
  schema_version: "1.0",
  node_version: process.version,
  python_version: pyVersion,
  generated_at: new Date().toISOString(),
  corpus: "packages/contracts/testdata/cross-language-cases.json",
  total_cases: total,
  agreement_count: agreementCount,
  agreement_percent: agreementPercent,
  expected_match_count: expectedMatchCount,
  typescript: { validator: "@fastwork/contracts (Ajv 2020, dist/validate.js)", passed: cases.filter((c) => c.typescript_valid).length, failed: cases.filter((c) => !c.typescript_valid).length },
  python: { validator: "fastwork_ai_worker.contracts.validator (minimal generic JSON-Schema)", passed: cases.filter((c) => c.python_valid).length, failed: cases.filter((c) => !c.python_valid).length },
  cases,
  blocking_errors: [],
};
mkdirSync(join(REBUILD, "reports"), { recursive: true });
writeFileSync(join(REBUILD, "reports", "cross-language-contract-report.json"), JSON.stringify(report, null, 2), "utf-8");
console.log(`cross-language report: ${agreementCount}/${total} agreement (${agreementPercent}%); expected-match ${expectedMatchCount}/${total} (${expectedMatchPercent}%)`);
if (agreementCount !== total) {
  console.error("M0 BLOCKING: TS/Python agreement < 100%");
  process.exit(1);
}

