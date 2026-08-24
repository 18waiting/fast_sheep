// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, resolveDataRoot, provisionDataRoot, SqliteConnection, MigrationRunner, PersistenceError, ERROR_CODES, DB_FILENAME, MIGRATIONS_DIR } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }

test("fresh database migrates to schema v1 and seeds defaults", () => {
  const { conn, schemaVersion } = openDatabase(root());
  assert.equal(schemaVersion, 7);
  assert.equal(conn.get("SELECT value FROM app_meta WHERE key = 'database_schema_version'").value, "7");
  assert.ok(conn.all("SELECT group_name FROM config_groups").length >= 9);
  conn.close();
});

test("migration rerun is a no-op (no duplicate effects)", () => {
  const r = root();
  openDatabase(r).conn.close();
  const b = openDatabase(r);
  assert.equal(b.conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 7);
  b.conn.close();
});

test("current database is a no-op (no pending migrations)", () => {
  const r = root();
  openDatabase(r).conn.close();
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  const runner = new MigrationRunner();
  const res = runner.migrate(conn, join(r, "backups", "db"));
  assert.equal(res.migratedCount, 0);
  assert.equal(res.backedUp, false);
  conn.close();
});

test("checksum mismatch is rejected", () => {
  const r = root();
  openDatabase(r).conn.close();
    const migDir = join(r, "mig"); mkdirSync(migDir, { recursive: true });
  copyFileSync(join(MIGRATIONS_DIR, "0001_initial.sql"), join(migDir, "0001_initial.sql"));
  const p = join(migDir, "0001_initial.sql");
  writeFileSync(p, readFileSync(p, "utf-8") + "\n-- altered\n");
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  assert.throws(() => new MigrationRunner(migDir).migrate(conn, join(r, "backups", "db")), (e) => e.code === ERROR_CODES.MIGRATION_CHECKSUM_MISMATCH);
  conn.close();
});

test("future schema version is rejected safely", () => {
  const r = root();
  const { conn } = openDatabase(r);
  conn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', '99')");
  conn.close();
  const conn2 = new SqliteConnection(join(r, DB_FILENAME));
  assert.throws(() => new MigrationRunner().migrate(conn2, join(r, "backups", "db")), (e) => e.code === ERROR_CODES.SCHEMA_TOO_NEW);
  conn2.close();
});

test("migration SQL failure rolls back and backup is preserved", () => {
  const r = root();
    const migDir = join(r, "mig"); mkdirSync(migDir, { recursive: true });
  copyFileSync(join(MIGRATIONS_DIR, "0001_initial.sql"), join(migDir, "0001_initial.sql"));
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  new MigrationRunner(migDir).migrate(conn, join(r, "backups", "db"));
  writeFileSync(join(migDir, "0002_broken.sql"), "CREATE TABLE broken (x TEXT); INSERT INTO nope VALUES (1);");
  const conn2 = new SqliteConnection(join(r, DB_FILENAME));
  assert.throws(() => new MigrationRunner(migDir).migrate(conn2, join(r, "backups", "db")), (e) => e.code === ERROR_CODES.MIGRATION_FAILED);
  assert.equal(conn2.get("SELECT name FROM sqlite_master WHERE type='table' AND name='broken'"), undefined);
  conn2.close();
});

test("backup created before existing-data upgrade", () => {
  const r = root();
    const migDir = join(r, "mig"); mkdirSync(migDir, { recursive: true });
  copyFileSync(join(MIGRATIONS_DIR, "0001_initial.sql"), join(migDir, "0001_initial.sql"));
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  new MigrationRunner(migDir).migrate(conn, join(r, "backups", "db"));
  writeFileSync(join(migDir, "0002_empty.sql"), "CREATE TABLE extra (x TEXT);");
  const conn2 = new SqliteConnection(join(r, DB_FILENAME));
  const res = new MigrationRunner(migDir).migrate(conn2, join(r, "backups", "db"));
  assert.equal(res.backedUp, true);
  assert.ok(existsSync(join(r, "backups", "db")));
  conn2.close();
});

test("corrupt migration metadata fails safely", () => {
  const r = root();
  const { conn } = openDatabase(r);
  conn.run("DELETE FROM schema_migrations");
  conn.close();
  const conn2 = new SqliteConnection(join(r, DB_FILENAME));
  // schema_migrations empty but tables exist -> migration 0001 would fail on CREATE TABLE without IF NOT EXISTS
  assert.throws(() => new MigrationRunner().migrate(conn2, join(r, "backups", "db")), (e) => e.code === ERROR_CODES.MIGRATION_FAILED);
  conn2.close();
});
