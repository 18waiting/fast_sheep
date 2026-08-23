// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: verify p0-golden-manifest.json integrity WITHOUT mutating fixtures or hashes.
// Expected frozen version: 2026-08-15.1; expected P0 count: 174 (computed, not trusted).
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..");
const MANIFEST = join(PROJECT, "parity-tests", "manifests", "p0-golden-manifest.json");
const FIXTURES = join(PROJECT, "parity-tests", "fixtures");

const EXPECTED_VERSION = "2026-08-15.1";
const EXPECTED_COUNT = 174;

if (!existsSync(MANIFEST)) { console.error("FAIL: p0-golden-manifest.json missing"); process.exit(1); }
const m = JSON.parse(readFileSync(MANIFEST, "utf-8"));
let errors = 0;
if (m.fixture_version !== EXPECTED_VERSION) { console.error(`FAIL: fixture_version=${m.fixture_version} expected ${EXPECTED_VERSION}`); errors++; }
if (m.p0_count !== EXPECTED_COUNT) { console.error(`FAIL: declared p0_count=${m.p0_count} expected ${EXPECTED_COUNT}`); errors++; }
const ids = new Set();
for (const c of m.cases) {
  if (ids.has(c.case_id)) { console.error(`FAIL: duplicate case_id ${c.case_id}`); errors++; }
  ids.add(c.case_id);
  if (!c.behavior_ids || c.behavior_ids.length === 0) { console.error(`FAIL: empty behavior_ids for ${c.case_id}`); errors++; }
  if (c.status !== "FROZEN") { console.error(`FAIL: status != FROZEN for ${c.case_id}`); errors++; }
  const fp = join(PROJECT, c.fixture);
  if (!existsSync(fp)) { console.error(`FAIL: fixture missing ${c.fixture}`); errors++; continue; }
  let data;
  try { data = JSON.parse(readFileSync(fp, "utf-8")); }
  catch { console.error(`FAIL: fixture unparseable ${c.fixture}`); errors++; continue; }
  if (data.case_id !== c.case_id) { console.error(`FAIL: fixture case_id ${data.case_id} != manifest ${c.case_id}`); errors++; }
  const h = createHash("sha256").update(readFileSync(fp)).digest("hex");
  if (h !== c.sha256) { console.error(`FAIL: sha256 mismatch ${c.case_id} (stored ${c.sha256.slice(0,12)}... actual ${h.slice(0,12)}...)`); errors++; }
}
if (m.cases.length !== EXPECTED_COUNT) { console.error(`FAIL: actual manifest case count ${m.cases.length} != ${EXPECTED_COUNT}`); errors++; }
if (errors === 0) console.log(`PASS: ${m.cases.length} P0 cases verified (version ${EXPECTED_VERSION}, unique ids, paths exist, sha256 match, status FROZEN)`);
else { console.error(`FAIL: ${errors} frozen-manifest error(s)`); process.exit(1); }
