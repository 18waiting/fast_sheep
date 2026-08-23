// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: validate every parity-tests/fixtures/**/*.json against
// parity-tests/contracts/golden-fixture.schema.json (draft-07, retained for compatibility).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..");
const FIXTURES = join(PROJECT, "parity-tests", "fixtures");
const SCHEMA_PATH = join(PROJECT, "parity-tests", "contracts", "golden-fixture.schema.json");

if (!existsSync(SCHEMA_PATH) || !existsSync(FIXTURES)) {
  console.error("FAIL: golden-fixture schema or fixtures dir missing");
  process.exit(1);
}
const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "legacy") walk(p, out); }
    else if (e.startsWith("GF-") && e.endsWith(".json")) out.push(p);
  }
}
const files = [];
walk(FIXTURES, files);
let valid = 0; const invalid = [];
for (const f of files) {
  let data;
  try { data = JSON.parse(readFileSync(f, "utf-8")); }
  catch { invalid.push({ f, reason: "unparseable" }); continue; }
  if (validate(data)) valid++;
  else invalid.push({ f, reason: validate.errors?.[0]?.message });
}
console.log(`GOLDEN SCHEMA VALIDATION: total=${files.length} valid=${valid} invalid=${invalid.length}`);
for (const e of invalid) console.error(`  INVALID ${e.f} :: ${e.reason}`);
if (invalid.length > 0) { process.exit(1); }

