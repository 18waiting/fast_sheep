// PACK-004: stage Electron runtime resources (clean-room).
//
// Responsibilities (Electron packaging staging only):
//   - Resolve the rebuild root from this script's location (no hardcoded E:\ paths).
//   - Preflight the PACK-002 packaged Worker runtime.
//   - Stage contracts schemas + registries into resources/contracts/.
//   - Stage persistence migrations into resources/persistence/migrations/.
//
// Destination is repeatable and cleanable (owned staging dirs are refreshed).
// Fails non-zero on any missing source. No network, no frozen-resource writes,
// no installer generation, no source-tree mutation.
import { existsSync, statSync, rmSync, mkdirSync } from "node:fs";
import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RES = join(ROOT, "resources");
const CONTRACTS_SRC = join(ROOT, "packages", "contracts");
const MIGRATIONS_SRC = join(ROOT, "packages", "persistence", "migrations");

const failures = [];
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS " : "FAIL ") + "[stage] " + name + (ok ? "" : " | " + extra));
  if (!ok) failures.push(name + (extra ? " | " + extra : ""));
};

// 1) PACK-002 packaged Worker runtime preflight (must exist, complete onedir).
const workerExe = join(RES, "worker", "fastwork-ai-worker.exe");
const workerInternal = join(RES, "worker", "_internal");
check("packaged worker executable exists", existsSync(workerExe) && statSync(workerExe).isFile(), workerExe);
check("packaged worker _internal runtime exists", existsSync(workerInternal) && statSync(workerInternal).isDirectory(), workerInternal);

// 2) Contracts schemas source preflight.
const schemasSrc = join(CONTRACTS_SRC, "schemas");
const registrySrc = join(CONTRACTS_SRC, "contract-registry.json");
const schemasRegistrySrc = join(schemasSrc, "registry.json");
check("contracts schemas source exists", existsSync(schemasSrc) && statSync(schemasSrc).isDirectory(), schemasSrc);
check("contract-registry.json source exists", existsSync(registrySrc) && statSync(registrySrc).isFile(), registrySrc);
check("schemas/registry.json source exists", existsSync(schemasRegistrySrc) && statSync(schemasRegistrySrc).isFile(), schemasRegistrySrc);

// 3) Persistence migrations source preflight.
const migrations = ["0001_initial.sql", "0002_feedback_effect_tracking.sql", "0003_learning_review_audit_optimization.sql", "0004_legacy_import_tracking.sql"];
for (const m of migrations) check("migration source " + m, existsSync(join(MIGRATIONS_SRC, m)), m);

if (failures.length > 0) {
  console.error("PACK-004 stage FAIL: " + failures.join("; "));
  process.exit(1);
}

// ---- Stage contracts ----
const contractsDest = join(RES, "contracts");
const schemasDest = join(contractsDest, "schemas");
rmSync(contractsDest, { recursive: true, force: true });
mkdirSync(schemasDest, { recursive: true });
await cp(schemasSrc, schemasDest, { recursive: true });
await cp(registrySrc, join(contractsDest, "contract-registry.json"));
await cp(schemasRegistrySrc, join(schemasDest, "registry.json"));
check("staged resources/contracts/schemas", existsSync(schemasDest) && (await readdir(schemasDest)).length > 0);
check("staged resources/contracts/contract-registry.json", existsSync(join(contractsDest, "contract-registry.json")));
check("staged resources/contracts/schemas/registry.json", existsSync(join(schemasDest, "registry.json")));

// ---- Stage persistence migrations ----
const persistenceDest = join(RES, "persistence");
const migrationsDest = join(persistenceDest, "migrations");
rmSync(persistenceDest, { recursive: true, force: true });
mkdirSync(migrationsDest, { recursive: true });
const sqlFiles = (await readdir(MIGRATIONS_SRC)).filter((f) => f.endsWith(".sql"));
for (const f of sqlFiles) await cp(join(MIGRATIONS_SRC, f), join(migrationsDest, f));
check("staged " + sqlFiles.length + " migration files", sqlFiles.length >= 4 && (await readdir(migrationsDest)).length === sqlFiles.length);

// ---- Record a small manifest of what was staged (evidence for the audit). ----
const sha = async (p) => createHash("sha256").update(await readFile(p)).digest("hex");
const manifest = {
  staged_at: new Date().toISOString(),
  worker: { executable: "worker/fastwork-ai-worker.exe", sha256: await sha(workerExe) },
  contracts: { schemas_dir: "contracts/schemas", registry: "contracts/contract-registry.json", schema_count: (await readdir(schemasDest, { recursive: true })).filter((e) => typeof e === "string" && e.endsWith(".schema.json")).length },
  migrations: sqlFiles.map((f) => ({ file: "persistence/migrations/" + f, sha256: sha(join(migrationsDest, f)) })),
};
await writeFile(join(RES, "staging-manifest.json"), JSON.stringify(manifest, null, 2));
check("staging manifest written", existsSync(join(RES, "staging-manifest.json")));

if (failures.length > 0) {
  console.error("PACK-004 stage FAIL: " + failures.join("; "));
  process.exit(1);
}
console.log("PACK-004 runtime resource staging PASS.");

