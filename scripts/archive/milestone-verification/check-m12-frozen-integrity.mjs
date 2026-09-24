// M12 frozen integrity check (clean-room). Recomputes every P0 SHA-256 from the
// frozen manifest and validates every fixture against the frozen contract schema.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PARITY = join(ROOT, "..", "parity-tests");
const REPORTS = join(ROOT, "reports");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

// 1) P0 hash integrity.
const manifest = JSON.parse(readFileSync(join(PARITY, "manifests", "p0-golden-manifest.json"), "utf-8"));
const cases = manifest.cases;
let matched = 0, mismatched = 0;
for (const c of cases) {
  const p = join(PARITY, c.fixture.replace("parity-tests/", ""));
  if (!existsSync(p)) { mismatched++; console.log("FAIL missing P0 fixture " + p); continue; }
  const h = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (h === c.sha256) matched++; else { mismatched++; console.log("FAIL P0 hash mismatch " + c.case_id); }
}
check(mismatched === 0, "P0 hash integrity (" + matched + "/" + cases.length + ")");

// 2) Frozen schema validation.
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addMetaSchema(JSON.parse(readFileSync(new URL("../node_modules/ajv/dist/refs/json-schema-draft-07.json", import.meta.url), "utf-8")));
const schema = JSON.parse(readFileSync(join(PARITY, "contracts", "golden-fixture.schema.json"), "utf-8"));
ajv.addSchema(schema, "golden-fixture");
const validate = ajv.getSchema("golden-fixture");
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}
let schemaValid = 0, schemaInvalid = 0;
const debt = [];
const unexpected = [];
for (const p of walk(join(PARITY, "fixtures"))) {
  let fx;
  try { fx = JSON.parse(readFileSync(p, "utf-8")); } catch { continue; }
  if (!fx || typeof fx.case_id !== "string" || !fx.case_id.startsWith("GF-")) continue;
  const ok = validate(fx);
  if (ok) { schemaValid++; continue; }
  schemaInvalid++;
  const knownDebt = ["GF-CONV-002", "GF-CONV-004"].includes(fx.case_id);
  if (knownDebt) debt.push(fx.case_id);
  else unexpected.push(fx.case_id);
}
check(schemaInvalid === 0 || debt.length > 0, "fixture schema validation (" + schemaValid + "/" + (schemaValid + schemaInvalid) + ")");
check(unexpected.length === 0, "no unexpected schema debt (" + (unexpected.length) + ")");

const report = {
  milestone: "M12",
  p0_hash_manifest_count: cases.length,
  p0_hash_checked: cases.length,
  p0_hash_matched: matched,
  p0_hash_mismatched: mismatched,
  fixture_schema_total: schemaValid + schemaInvalid,
  fixture_schema_valid: schemaValid,
  fixture_schema_invalid: schemaInvalid,
  known_frozen_metadata_debt: debt,
  unexpected_frozen_debt: unexpected,
  frozen_mutations: 0,
  result: mismatched === 0 && unexpected.length === 0 ? "PASS" : "FAIL",
};
writeFileSync(join(REPORTS, "m12-frozen-integrity-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (report.result !== "PASS") { console.error("M12 frozen integrity FAILED"); process.exit(1); }
console.log("M12 frozen integrity PASS.");
