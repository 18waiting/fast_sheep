// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: compile every registered JSON Schema; fail on invalid schema, duplicate $id,
// unresolved $ref, missing registry, or registry pointing to a missing schema file.
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const PACKAGE = join(REBUILD, "packages", "contracts");

const registryPath = join(PACKAGE, "contract-registry.json");
if (!existsSync(registryPath)) { console.error("FAIL: contract-registry.json missing"); process.exit(1); }
const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
const ajv = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": { type: "string", validate: (s) => !Number.isNaN(Date.parse(s)) } } });

function collectRefs(node, out = []) {
  if (Array.isArray(node)) { for (const x of node) collectRefs(x, out); }
  else if (node !== null && typeof node === "object") {
    if (typeof node.$ref === "string") out.push(node.$ref);
    for (const k of Object.keys(node)) collectRefs(node[k], out);
  }
  return out;
}

let errors = 0;
const seen = new Set();
const ids = new Set();
for (const c of registry.contracts) {
  if (!c.id || !c.schema) { console.error("FAIL: contract missing id/schema", c); errors++; continue; }
  if (seen.has(c.id)) { console.error(`FAIL: duplicate contract id ${c.id}`); errors++; }
  seen.add(c.id); ids.add(c.id);
  const sp = join(PACKAGE, c.schema);
  if (!existsSync(sp)) { console.error(`FAIL: registry points to missing schema ${c.schema}`); errors++; continue; }
  let schema;
  try { schema = JSON.parse(readFileSync(sp, "utf-8")); }
  catch (e) { console.error(`FAIL: schema not valid JSON ${c.schema}: ${e.message}`); errors++; continue; }
  if (schema.$id !== c.id) { console.error(`FAIL: schema $id mismatch for ${c.id} (file says ${schema.$id})`); errors++; }
  try { ajv.addSchema(schema); }
  catch (e) { console.error(`FAIL: schema compile error ${c.id}: ${e.message}`); errors++; }
}
for (const c of registry.contracts) {
  const sp = join(PACKAGE, c.schema);
  let schema;
  try { schema = JSON.parse(readFileSync(sp, "utf-8")); } catch { continue; }
  for (const ref of collectRefs(schema)) {
    if (typeof ref === "string" && ref.startsWith("fastwork:") && !ids.has(ref)) { console.error(`FAIL: unresolved $ref ${ref} in ${c.id}`); errors++; }
  }
  try { ajv.getSchema(c.id); }
  catch (e) { console.error(`FAIL: compile/ref error ${c.id}: ${e.message}`); errors++; }
}
if (errors === 0) console.log(`PASS: ${registry.contracts.length} registered contracts compiled, no duplicate $id, no unresolved $ref`);
else { console.error(`FAIL: ${errors} contract integrity error(s)`); process.exit(1); }

