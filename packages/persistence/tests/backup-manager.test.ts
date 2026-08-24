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

test("createBackup reuses verified boundary, writes DB + metadata (schema version 7)", () => {
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