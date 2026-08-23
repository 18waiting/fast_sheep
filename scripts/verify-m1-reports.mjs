// Clean-room implementation. M1 (TASK-016): verify M1 reports exist, are well-formed,
// and reflect passing results (migration tests, repository tests, python runtime, M1 parity
// subset). Used by CI as the M1 report/parity gate. No fixture execution; no network.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "..", "reports");

function read(name) {
  const p = join(REPORTS, name);
  if (!existsSync(p)) throw new Error("MISSING REPORT: " + name);
  return JSON.parse(readFileSync(p, "utf-8"));
}

const failures = [];

function check(cond, msg) {
  if (!cond) failures.push(msg);
  console.log((cond ? "PASS " : "FAIL ") + msg);
}

const migration = read("migration-test-report.json");
check(migration.schema_version === "1.0", "migration-test-report.json schema_version");
check(migration.database_schema_version === 1, "migration-test-report.json database_schema_version=1");
check(migration.all_passed === true, "migration-test-report.json all_passed");

const repo = read("repository-test-report.json");
check(repo.schema_version === "1.0", "repository-test-report.json schema_version");
check(repo.all_passed === true, "repository-test-report.json all_passed");
check(repo.cross_process_sqlite?.result === "PASS", "repository-test-report.json cross_process_sqlite PASS");
check(repo.wal_contention?.result === "PASS", "repository-test-report.json wal_contention PASS");
check(repo.single_writer_guard?.result === "PASS", "repository-test-report.json single_writer_guard PASS");

const rt = read("python-runtime-report.json");
check(rt.meets_requirement === true, "python-runtime-report.json meets_requirement");

const parity = read("m1-parity-report.json");
const cases = parity.cases ?? [];
check(cases.length === 4, "m1-parity-report.json has 4 cases");
for (const id of ["GF-STORE-001", "GF-STORE-002", "GF-STORE-006", "GF-STORE-007"]) {
  const c = cases.find((x) => x.case_id === id);
  check(!!c && c.result === "PASS", "m1-parity-report.json " + id + " PASS");
}
check(parity.legacy_import_fixtures === "DEFERRED_TO_M11", "m1-parity-report.json legacy DEFERRED_TO_M11");

if (failures.length > 0) {
  console.error("M1 report verification FAILED: " + failures.join("; "));
  process.exit(1);
}
console.log("M1 reports verified OK.");
