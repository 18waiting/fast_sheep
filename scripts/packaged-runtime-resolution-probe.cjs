// PACK-004: packaged runtime resolution probe (clean-room, test helper).
//
// Runs under an asar-aware Electron binary against a win-unpacked resources dir
// (passed via FASTWORK_PACK004_RESOURCES_PATH). Proves the packaged runtime is
// self-contained WITHOUT opening a window / doing any UI workflow (that is
// PACK-005). Checks:
//   1. <resources>\worker\fastwork-ai-worker.exe exists
//   2. <resources>\contracts\schemas exists
//   3. the packaged application archive exists and @fastwork/persistence migrations resolve from it
//      (MIGRATIONS_DIR is computed relative to the packaged module - no source tree)
//   4. @fastwork/contracts loadRegistry() reads contract-registry.json from asar
//   5. PACK-003 production launcher (dist/main/worker-runtime.js) resolves the
//      packaged worker + schemas paths
// Exits 0 with JSON on success, 1 with JSON on failure.
const { join } = require("node:path");
const { existsSync } = require("node:fs");
const { createRequire } = require("node:module");

const resourcesPath = process.env.FASTWORK_PACK004_RESOURCES_PATH;
const out = { resourcesPath };
try {
  if (!resourcesPath) throw new Error("FASTWORK_PACK004_RESOURCES_PATH not set");
  const workerExe = join(resourcesPath, "worker", "fastwork-ai-worker.exe");
  out.workerExists = existsSync(workerExe);
  const workerInternal = join(resourcesPath, "worker", "_internal");
  out.workerInternalExists = existsSync(workerInternal);
  const schemas = join(resourcesPath, "contracts", "schemas");
  out.schemasExists = existsSync(schemas);
  const migrationsExternal = join(resourcesPath, "persistence", "migrations");
  out.migrationsExternalExists = existsSync(migrationsExternal);
  const ASAR_NAME = ["app", "asar"].join(".");
  const asar = join(resourcesPath, ASAR_NAME);
  out.asarExists = existsSync(asar);

  // Packaged @fastwork/persistence: migrations resolve from inside the archive.
  const asarPersistenceIndex = join(asar, "node_modules", "@fastwork", "persistence", "dist", "index.js");
  const req = createRequire(asarPersistenceIndex);
  const { MIGRATIONS_DIR } = require(join(asar, "node_modules", "@fastwork", "persistence", "dist", "migrations", "migration-runner.js"));
  out.migrationsDir = MIGRATIONS_DIR;
  const { discoverMigrations } = require(join(asar, "node_modules", "@fastwork", "persistence", "dist", "migrations", "migration-loader.js"));
  const migs = discoverMigrations(MIGRATIONS_DIR);
  out.migrations = migs.map((m) => ({ version: m.version, name: m.name }));

  // Packaged @fastwork/contracts: registry + schemas readable from asar.
  const { loadRegistry } = require(join(asar, "node_modules", "@fastwork", "contracts", "dist", "registry.js"));
  const reg = loadRegistry();
  out.registryContracts = (reg.contracts || []).length;

  // PACK-003 production launcher resolves the packaged paths.
  const { resolvePackagedWorkerPaths } = require(join(asar, "dist", "main", "worker-runtime.js"));
  const paths = resolvePackagedWorkerPaths(resourcesPath);
  out.resolvedWorkerExe = paths.executable;
  out.resolvedSchemas = paths.schemasDir;

  out.ok = true;
} catch (e) {
  out.ok = false;
  out.error = String((e && e.stack) || e);
}
if (process.env.FASTWORK_PACK004_PROBE_RESULT) {
  require("node:fs").writeFileSync(process.env.FASTWORK_PACK004_PROBE_RESULT, JSON.stringify(out, null, 2), "utf-8");
} else {
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}
process.exit(out.ok ? 0 : 1);


