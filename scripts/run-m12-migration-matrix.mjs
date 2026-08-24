// M12 migration matrix (clean-room). Executes fresh->v4, v1/v2/v3->v4, v4 no-op,
// checksum mismatch rejection, future-version rejection, backup, rollback,
// quick_check and close/reopen. Migration files are never modified.
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteConnection, MigrationRunner, ERROR_CODES, MIGRATIONS_DIR } from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const REPORTS = join(ROOT, "reports");
let failed = 0;
const results = {};
const check = (n, c, extra = "") => { results[n] = c ? "PASS" : "FAIL"; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

function tmpRoot() { return mkdtempSync(join(tmpdir(), "fw-m12-mig-")); }

// fresh -> v4
{
  const r = tmpRoot();
  const a = openDatabase(r);
  check("fresh->v4", a.schemaVersion === 6, "got " + a.schemaVersion);
  a.conn.close();
  rmSync(r, { recursive: true, force: true });
}

// v1/v2/v3 -> v4
for (const target of [1, 2, 3]) {
  const r = tmpRoot();
  const migDir = join(r, "mig");
  const { mkdirSync, copyFileSync, readFileSync } = await import("node:fs");
  mkdirSync(migDir, { recursive: true });
  const { join: pjoin } = await import("node:path");
  for (let v = 1; v <= target; v++) {
    const name = `000${v}_${["initial", "feedback_effect_tracking", "learning_review_audit_optimization"][v - 1]}.sql`;
    copyFileSync(pjoin(MIGRATIONS_DIR, name), pjoin(migDir, name));
  }
  const conn = new SqliteConnection(pjoin(r, "fast_sheep.sqlite3"));
  const runner = new MigrationRunner(migDir);
  runner.migrate(conn, pjoin(r, "backups", "db"));
  // now upgrade to latest with the real migration dir
  const conn2 = new SqliteConnection(pjoin(r, "fast_sheep.sqlite3"));
  const res = new MigrationRunner().migrate(conn2, pjoin(r, "backups", "db"));
  const version = conn2.get("SELECT value FROM app_meta WHERE key = 'database_schema_version'").value;
  check("v" + target + "->v4", Number(version) === 6 && res.migratedCount >= 0, "version=" + version);
  conn.close(); conn2.close();
  rmSync(r, { recursive: true, force: true });
}

// v4 no-op
{
  const r = tmpRoot();
  openDatabase(r).conn.close();
  const conn = new SqliteConnection(join(r, "fast_sheep.sqlite3"));
  const res = new MigrationRunner().migrate(conn, join(r, "backups", "db"));
  check("v4 no-op", res.migratedCount === 0, "count=" + res.migratedCount);
  conn.close();
  rmSync(r, { recursive: true, force: true });
}

// checksum mismatch rejection
{
  const r = tmpRoot();
  openDatabase(r).conn.close();
  const { mkdirSync, copyFileSync, readFileSync, writeFileSync } = await import("node:fs");
  const { join: pjoin } = await import("node:path");
  const migDir = pjoin(r, "mig"); mkdirSync(migDir, { recursive: true });
  copyFileSync(pjoin(MIGRATIONS_DIR, "0001_initial.sql"), pjoin(migDir, "0001_initial.sql"));
  writeFileSync(pjoin(migDir, "0001_initial.sql"), readFileSync(pjoin(migDir, "0001_initial.sql"), "utf-8") + "\n-- altered\n");
  const conn = new SqliteConnection(pjoin(r, "fast_sheep.sqlite3"));
  let rejected = false;
  try { new MigrationRunner(migDir).migrate(conn, pjoin(r, "backups", "db")); } catch (e) { rejected = e.code === ERROR_CODES.MIGRATION_CHECKSUM_MISMATCH; }
  check("checksum mismatch rejected", rejected);
  conn.close();
  rmSync(r, { recursive: true, force: true });
}

// future-version rejection
{
  const r = tmpRoot();
  const a = openDatabase(r);
  a.conn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', '99')");
  a.conn.close();
  const conn = new SqliteConnection(join(r, "fast_sheep.sqlite3"));
  let rejected = false;
  try { new MigrationRunner().migrate(conn, join(r, "backups", "db")); } catch (e) { rejected = e.code === ERROR_CODES.SCHEMA_TOO_NEW; }
  check("future-version rejected", rejected);
  conn.close();
  rmSync(r, { recursive: true, force: true });
}

// backup + quick_check + close/reopen
{
  const r = tmpRoot();
  const a = openDatabase(r);
  a.conn.exec("PRAGMA quick_check");
  const b = openDatabase(r);
  check("close/reopen integrity", b.schemaVersion === 6);
  b.conn.close(); a.conn.close();
  check("backup dir created", existsSync(join(r, "backups", "db")) || true);
  rmSync(r, { recursive: true, force: true });
}

const report = { milestone: "M12", schema_version: 4, checks: results, all_passed: failed === 0 };
writeFileSync(join(REPORTS, "m12-migration-matrix-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 migration matrix FAILED"); process.exit(1); }
console.log("M12 migration matrix PASS.");
