// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1.5-R06: Backup/Restore Foundation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openDatabase, SqliteConnection, DB_FILENAME,
  createBackup, listBackups, restoreBackup, rotateBackups, BACKUP_METADATA_FILENAME,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-bak-")); }

test("createBackup produces consistent VACUUM INTO snapshot + metadata (schema version 7)", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('m1','m')");
  conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  assert.ok(existsSync(meta.backupFile));
  assert.ok(existsSync(join(meta.backupDir, BACKUP_METADATA_FILENAME)));
  assert.equal(meta.databaseSchemaVersion, 7);
  assert.equal(meta.databaseFilename, DB_FILENAME);
  const listed = listBackups(join(r, "backups"));
  assert.equal(listed.length, 1);
  assert.equal(listed[0].backupFile, meta.backupFile);
});

test("restore happy path: data restored; quick_check + schema validation + reopen smoke", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('m1','商户甲')");
  conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES ('s1','m1','店','pdd')");
  conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);

  // damage current DB
  const { conn: c2 } = openDatabase(r);
  c2.run("DELETE FROM stores");
  c2.run("DELETE FROM merchants");
  assert.equal(c2.get("SELECT COUNT(*) AS c FROM merchants").c, 0);
  c2.close();

  restoreBackup(meta.backupFile, dbPath);
  const reopened = openDatabase(r);
  assert.equal(reopened.schemaVersion, 7, "schema validation after restore");
  assert.equal(reopened.conn.get("SELECT name FROM merchants WHERE id='m1'").name, "商户甲", "data restored");
  const integrity = reopened.conn.all<{ integrity_check: string }>("PRAGMA integrity_check");
  assert.equal(integrity[0].integrity_check, "ok", "quick_check/integrity after restore");
  reopened.conn.close();
});

test("restore rejects corrupted/tampered backup; current DB intact and reopenable", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('keep','keep')");
  conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);

  // tamper the backup DB file
  writeFileSync(meta.backupFile, "THIS IS NOT A SQLITE DATABASE; CORRUPTED", "utf-8");

  assert.throws(() => restoreBackup(meta.backupFile, dbPath), /corrupt|integrity/i);
  // current DB still intact and reopenable
  const reopened = openDatabase(r);
  assert.equal(reopened.schemaVersion, 7);
  assert.equal(reopened.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 1, "current data intact");
  reopened.conn.close();
});

test("restore rejects incomplete backup (missing metadata)", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  openDatabase(r).conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  rmSync(join(meta.backupDir, BACKUP_METADATA_FILENAME), { force: true });
  assert.throws(() => restoreBackup(meta.backupFile, dbPath), /metadata missing/i);
});

test("restore rejects backup with schema newer than supported", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  openDatabase(r).conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  // forge metadata to a future schema
  const metaPath = join(meta.backupDir, BACKUP_METADATA_FILENAME);
  const forged = JSON.parse(readFileSync(metaPath, "utf-8"));
  forged.databaseSchemaVersion = 99;
  writeFileSync(metaPath, JSON.stringify(forged));
  assert.throws(() => restoreBackup(meta.backupFile, dbPath), /newer than supported/i);
});

test("rotateBackups is capability only: explicit maxBackups; keeps newest N; no default/auto", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('m1','m')");
  conn.close();
  const backupRoot = join(r, "backups");
  const m1 = createBackup(dbPath, backupRoot, 7);
  const m2 = createBackup(dbPath, backupRoot, 7);
  const m3 = createBackup(dbPath, backupRoot, 7);
  assert.equal(listBackups(backupRoot).length, 3, "no auto-rotation: all 3 retained after createBackup");
  assert.throws(() => rotateBackups(backupRoot, 0), /maxBackups/);
  const removed = rotateBackups(backupRoot, 2);
  assert.equal(removed, 1);
  const remaining = listBackups(backupRoot);
  assert.equal(remaining.length, 2);
  const remainingFiles = remaining.map((b) => b.backupFile);
  assert.ok(remainingFiles.includes(m3.backupFile) && remainingFiles.includes(m2.backupFile), "newest 2 kept");
  assert.ok(!existsSync(m1.backupDir), "oldest removed");
});

test("secret exclusion boundary: backup dir contains only DB + metadata (no SecretStore artifacts)", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  openDatabase(r).conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  const files = readdirSync(meta.backupDir);
  assert.deepEqual(files.sort(), [BACKUP_METADATA_FILENAME, DB_FILENAME], "only DB + approved metadata");
});

// --- tightened acceptance: failed restore preserves current DB (corrupt / future-schema / mismatch) ---
test("failed restore (future-schema) preserves current DB intact and reopenable", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('keep','keep')");
  conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  // forge metadata to future schema (99)
  const metaPath = join(meta.backupDir, BACKUP_METADATA_FILENAME);
  const forged = JSON.parse(readFileSync(metaPath, "utf-8"));
  forged.databaseSchemaVersion = 99;
  writeFileSync(metaPath, JSON.stringify(forged));
  assert.throws(() => restoreBackup(meta.backupFile, dbPath), /newer than supported/i);
  const reopened = openDatabase(r);
  assert.equal(reopened.schemaVersion, 7, "current DB still v7");
  assert.equal(reopened.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 1, "current data intact");
  reopened.conn.close();
});

test("failed restore (metadata/schema mismatch) preserves current DB intact and reopenable", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('keep','keep')");
  conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  // alter the BACKUP DB's actual schema version so it no longer matches metadata (7)
  const bkConn = new SqliteConnection(meta.backupFile);
  bkConn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', '6')");
  bkConn.close();
  assert.throws(() => restoreBackup(meta.backupFile, dbPath), /schema mismatch/i);
  const reopened = openDatabase(r);
  assert.equal(reopened.schemaVersion, 7, "current DB still v7");
  assert.equal(reopened.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 1, "current data intact");
  reopened.conn.close();
});

// --- tightened: metadata cannot cause path breakout ---
test("path breakout: metadata pointing outside backupRoot is skipped by list and rejected by restore", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  openDatabase(r).conn.close();
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  // forge metadata.backupFile to an outside path
  const outside = join(tmpdir(), "outside-target.sqlite3");
  const metaPath = join(meta.backupDir, BACKUP_METADATA_FILENAME);
  const forged = JSON.parse(readFileSync(metaPath, "utf-8"));
  forged.backupFile = outside;
  writeFileSync(metaPath, JSON.stringify(forged));
  // listBackups must NOT follow it (skip)
  assert.equal(listBackups(join(r, "backups")).length, 0, "escaping metadata skipped");
  // restore must reject (metadata backupFile mismatch)
  assert.throws(() => restoreBackup(meta.backupFile, dbPath), /backupFile mismatch/i);
});

// --- tightened: rotation fail-safe ---
test("rotation fail-safe: invalid maxBackups throws and deletes nothing", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  openDatabase(r).conn.close();
  const backupRoot = join(r, "backups");
  createBackup(dbPath, backupRoot, 7);
  createBackup(dbPath, backupRoot, 7);
  assert.throws(() => rotateBackups(backupRoot, 0), /maxBackups/);
  assert.throws(() => rotateBackups(backupRoot, -1), /maxBackups/);
  assert.throws(() => rotateBackups(backupRoot, 1.5), /maxBackups/);
  assert.equal(listBackups(backupRoot).length, 2, "no backup deleted on invalid input");
});

// --- REPAIR: active/WAL backup consistency ---
test("active/WAL backup consistency: committed WAL data + schema + integrity present in independently-opened backup", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  // keep the connection OPEN (active) and suppress autocheckpoint so the committed row
  // stays in WAL un-checkpointed at snapshot time
  conn.exec("PRAGMA wal_autocheckpoint = 0");
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('wal-m1','WAL商户')");
  // create backup while the source connection is still open
  const meta = createBackup(dbPath, join(r, "backups"), 7);
  // open the backup independently
  const bk = new SqliteConnection(meta.backupFile);
  try {
    assert.equal(bk.get("SELECT name FROM merchants WHERE id='wal-m1'").name, "WAL商户", "latest committed data captured");
    const integrity = bk.all<{ integrity_check: string }>("PRAGMA integrity_check");
    assert.equal(integrity[0].integrity_check, "ok", "integrity ok");
    assert.equal(bk.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "7", "schema v7 in backup");
  } finally {
    bk.close();
  }
  conn.close();
});

// --- REPAIR: failed backup creation leaves no valid-looking backup ---
test("failed backup creation leaves no valid-looking backup in listBackups", () => {
  const r = root();
  const backupRoot = join(r, "backups");
  const missing = join(r, "does-not-exist.sqlite3");
  assert.throws(() => createBackup(missing, backupRoot, 7));
  assert.equal(listBackups(backupRoot).length, 0, "no recoverable backup after failure");
  if (existsSync(backupRoot)) {
    const entries = readdirSync(backupRoot, { withFileTypes: true });
    assert.equal(entries.length, 0, "no partial files left behind");
  }
});