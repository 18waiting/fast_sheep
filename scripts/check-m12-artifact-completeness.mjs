// M12 artifact completeness (clean-room). Every required M0-M11 + M12 path must exist.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FW = join(ROOT, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

const requiredDocs = [
  "m1-implementation-report.md","m2-rpc-implementation-report.md","m3-rag-implementation-report.md","m4-implementation-report.md","m5-implementation-report.md","m6-implementation-report.md","m7-implementation-report.md","m8-implementation-report.md","m9-implementation-report.md","m10-implementation-report.md","m11-implementation-report.md","m12-preflight.md",
];
for (const d of requiredDocs) check(existsSync(join(FW, "spec", "rebuild", d)), "doc " + d);

const contracts = readdirSync(join(FW, "static", "rebuild", "contracts")).filter((f) => f.endsWith(".json"));
check(contracts.length >= 10, "machine contracts present (" + contracts.length + ")");

const reports = readdirSync(join(ROOT, "reports")).filter((f) => f.endsWith(".json"));
check(reports.length >= 40, "reports present (" + reports.length + ")");

const migrations = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql"];
for (const m of migrations) check(existsSync(join(ROOT, "packages", "persistence", "migrations", m)), "migration " + m);

const registry = JSON.parse(readFileSync(join(ROOT, "packages", "contracts", "schemas", "registry.json"), "utf-8"));
check(registry.schemas.length >= 183, "schema registry (" + registry.schemas.length + ")");

const report = { milestone: "M12", docs: requiredDocs.length, contracts: contracts.length, reports: reports.length, migrations: migrations.length, schema_registry: registry.schemas.length, missing: failures.length, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m12-artifact-completeness-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) process.exit(1);
console.log("M12 artifact completeness PASS.");
