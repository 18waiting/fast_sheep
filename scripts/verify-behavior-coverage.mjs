// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: behavior coverage validator over all-behaviors.json + parity-suite.json.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..", "..");
const BEHAVIORS = join(PROJECT, "parity-tests", "manifests", "all-behaviors.json");
const SUITE = join(PROJECT, "static", "rebuild", "contracts", "parity-suite.json");
const FIXTURES = join(PROJECT, "parity-tests", "fixtures");

const VALID_CLASS = new Set(["REFERENCE_PARITY","DESIGN_CONFORMANCE","SECURITY_IMPROVEMENT","COMPATIBILITY"]);
const VALID_PARITY = new Set(["P0","P1","P2","P3"]);

let errors = 0;
const b = JSON.parse(readFileSync(BEHAVIORS, "utf-8")).behaviors;
const suite = JSON.parse(readFileSync(SUITE, "utf-8"));
const ids = new Set();
for (const [k, v] of Object.entries(b)) {
  if (ids.has(k)) { console.error(`FAIL: duplicate behavior id ${k}`); errors++; }
  ids.add(k);
  if (!VALID_CLASS.has(v.test_class)) { console.error(`FAIL: bad test_class ${v.test_class} for ${k}`); errors++; }
  if (!VALID_PARITY.has(v.parity)) { console.error(`FAIL: bad parity ${v.parity} for ${k}`); errors++; }
  if (v.parity === "P0" && v.coverage === "UNCOVERED") { console.error(`FAIL: uncovered P0 ${k}`); errors++; }
  if (v.parity === "P0" && (!v.fixtures || v.fixtures.length === 0)) { console.error(`FAIL: P0 ${k} has no fixture`); errors++; }
  for (const fid of v.fixtures ?? []) {
    const fp = join(FIXTURES, fid.split("-")[1].toLowerCase(), fid + ".json");
    if (!existsSync(fp)) { console.error(`FAIL: fixture path missing for ${k}: ${fid}`); errors++; }
  }
}
const uncovered = Object.entries(b).filter(([, v]) => v.coverage === "UNCOVERED").map(([k]) => k);
if (uncovered.length) { console.error(`FAIL: uncovered behaviors: ${uncovered.join(",")}`); errors++; }
if (errors === 0) console.log(`PASS: ${Object.keys(b).length} behaviors validated; P0 covered; enums valid`);
else { console.error(`FAIL: ${errors} coverage error(s)`); process.exit(1); }
