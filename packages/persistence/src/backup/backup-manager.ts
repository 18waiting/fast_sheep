// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1.5-R06: Backup / Restore Foundation (Phase 1 early item of R-06).
//
// Owner tightening applied (2026-08-25 REPAIR — Backup Creation Consistency):
// 1. createBackup does NOT plain-copy the possibly-in-use main .sqlite3 file. The
//    persistence architecture runs SQLite in WAL mode (applyPragmas), so a bare copy
//    would miss un-checkpointed committed WAL content. createBackup uses SQLite's
//    canonical consistent snapshot primitive `VACUUM INTO`, which produces a complete,
//    committed, atomic single-file snapshot safe with active connections.
// 2. MigrationRunner's existing migration-before-upgrade backup (backupDatabase) is
//    LEFT UNCHANGED (this REPAIR does not alter it; any change there would be a
//    separate decision).
// 3. Active/WAL backup consistency is tested: committed data written under WAL is
//    present in the independently-opened backup.
// 4. Failed backup creation cleans up partial artifacts so no incomplete file enters
//    listBackups()'s recoverable set.
// 5. Controlled restore, DB-evidence schema compat, backupRoot path constraints,
//    rotation mechanism-only, and secret-by-responsibility remain as refined.

import { existsSync, writeFileSync, readFileSync, copyFileSync, renameSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { DB_FILENAME } from "../db/data-root.js";
import { SUPPORTED_DB_SCHEMA_VERSION } from "../db/schema-version.js";
import { SqliteConnection } from "../db/sqlite-driver.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";

export const BACKUP_METADATA_FILENAME = "backup-metadata.json";

export interface BackupMetadata {
  createdAt: string;
  databaseSchemaVersion: number;
  databaseFilename: string;
  /** Absolute path to the backup database file. */
  backupFile: string;
  /** Absolute path to the backup directory (timestamped). */
  backupDir: string;
}

function metadataPathFor(backupDir: string): string {
  return join(backupDir, BACKUP_METADATA_FILENAME);
}

/** Resolve `candidate` and require it to stay within `root` (no path breakout). */
function assertWithin(root: string, candidate: string): string {
  const r = resolve(root);
  const c = resolve(candidate);
  if (c !== r && !c.startsWith(r + sep)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `path escapes backup root: ${candidate}`);
  }
  return c;
}

/**
 * Consistent snapshot via SQLite `VACUUM INTO` (canonical safe snapshot primitive):
 * produces a complete committed snapshot including un-checkpointed WAL content, safe
 * with active connections, atomic single-file output. Fail-safe: a missing/locked DB
 * throws and produces no snapshot.
 */
function snapshotDatabase(databasePath: string, targetPath: string): void {
  if (!existsSync(databasePath)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup failed: no database file at ${databasePath}`);
  }
  const conn = new SqliteConnection(databasePath);
  try {
    const escaped = targetPath.replace(/'/g, "''");
    conn.exec(`VACUUM INTO '${escaped}'`);
  } finally {
    conn.close();
  }
}

/** Validate a snapshot using DB evidence only (openable + integrity + schema). */
function validateSnapshot(snapshotPath: string, expectedSchemaVersion: number): void {
  const conn = new SqliteConnection(snapshotPath);
  try {
    let integrity: Array<{ integrity_check: string }>;
    try {
      integrity = conn.all<{ integrity_check: string }>("PRAGMA integrity_check");
    } catch (e) {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: ${(e as Error).message}`);
    }
    if ((integrity[0]?.integrity_check ?? "") !== "ok") {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: integrity_check=${integrity[0]?.integrity_check}`);
    }
    const row = conn.get<{ value: string } | undefined>("SELECT value FROM app_meta WHERE key='database_schema_version'");
    const actual = row ? Number(row.value) : 0;
    if (actual !== expectedSchemaVersion) {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup schema mismatch: expected=${expectedSchemaVersion} db=${actual}`);
    }
    if (actual > SUPPORTED_DB_SCHEMA_VERSION) {
      throw new PersistenceError(ERROR_CODES.SCHEMA_TOO_NEW, `backup schema ${actual} newer than supported ${SUPPORTED_DB_SCHEMA_VERSION}`);
    }
  } finally {
    conn.close();
  }
}

/**
 * Create a CONSISTENT backup snapshot (VACUUM INTO) + approved metadata.
 * On ANY failure, partial artifacts are removed so no incomplete backup becomes
 * recoverable via listBackups().
 * @param schemaVersion current applied database schema version (from the DB/app_meta).
 */
export function createBackup(databasePath: string, backupRoot: string, schemaVersion: number): BackupMetadata {
  const root = resolve(backupRoot);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(root, stamp);
  const finalPath = join(backupDir, DB_FILENAME);
  const tempPath = join(backupDir, `.snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  mkdirSync(backupDir, { recursive: true });
  try {
    snapshotDatabase(databasePath, tempPath);
    validateSnapshot(tempPath, schemaVersion);
    renameSync(tempPath, finalPath);
    const meta: BackupMetadata = {
      createdAt: new Date().toISOString(),
      databaseSchemaVersion: schemaVersion,
      databaseFilename: DB_FILENAME,
      backupFile: finalPath,
      backupDir,
    };
    writeFileSync(metadataPathFor(backupDir), JSON.stringify(meta, null, 2), "utf-8");
    return meta;
  } catch (e) {
    // never leave a valid-looking incomplete backup behind
    for (const p of [tempPath, finalPath, metadataPathFor(backupDir)]) {
      if (existsSync(p)) rmSync(p, { force: true });
    }
    if (existsSync(backupDir) && readdirSync(backupDir).length === 0) rmSync(backupDir, { recursive: true, force: true });
    throw e;
  }
}

/** List backups under backupRoot, newest first. Entries whose paths escape backupRoot are skipped (not followed). */
export function listBackups(backupRoot: string): BackupMetadata[] {
  if (!existsSync(backupRoot)) return [];
  const root = resolve(backupRoot);
  const out: BackupMetadata[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const metaPath = metadataPathFor(dir);
    if (!existsSync(metaPath)) continue; // incomplete backup -> not listed
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as BackupMetadata;
      assertWithin(root, meta.backupDir ?? "");
      assertWithin(root, meta.backupFile ?? "");
      if (meta.backupFile && existsSync(meta.backupFile)) out.push(meta);
    } catch {
      // corrupt or escaping metadata -> skip listing (restore will reject it)
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

/** Read metadata beside a backup file; reject if tampered (backupFile mismatch or path breakout). */
function readBackupMetadata(backupFile: string): BackupMetadata {
  const backupDir = dirname(backupFile);
  const metaPath = metadataPathFor(backupDir);
  if (!existsSync(metaPath)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup incomplete: metadata missing for ${backupFile}`);
  }
  let meta: BackupMetadata;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf-8")) as BackupMetadata;
  } catch {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: unreadable metadata for ${backupFile}`);
  }
  if (resolve(meta.backupFile ?? "") !== resolve(backupFile)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: metadata backupFile mismatch for ${backupFile}`);
  }
  return meta;
}

/** Validate a staged copy of a backup using DB EVIDENCE only (openable + integrity + schema). */
function validateStagedBackup(stagedPath: string, expectedSchemaVersion: number): void {
  const conn = new SqliteConnection(stagedPath);
  try {
    let integrity: Array<{ integrity_check: string }>;
    try {
      integrity = conn.all<{ integrity_check: string }>("PRAGMA integrity_check");
    } catch (e) {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: ${(e as Error).message}`);
    }
    if ((integrity[0]?.integrity_check ?? "") !== "ok") {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: integrity_check=${integrity[0]?.integrity_check}`);
    }
    const row = conn.get<{ value: string } | undefined>("SELECT value FROM app_meta WHERE key='database_schema_version'");
    const actual = row ? Number(row.value) : 0;
    if (actual !== expectedSchemaVersion) {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup schema mismatch: metadata=${expectedSchemaVersion} db=${actual}`);
    }
    if (actual > SUPPORTED_DB_SCHEMA_VERSION) {
      throw new PersistenceError(ERROR_CODES.SCHEMA_TOO_NEW, `backup schema ${actual} newer than supported ${SUPPORTED_DB_SCHEMA_VERSION}`);
    }
  } finally {
    conn.close();
  }
}

/**
 * Controlled / fail-safe restore:
 * 1. Reject if backup schema version (metadata) > SUPPORTED_DB_SCHEMA_VERSION.
 * 2. Copy backup to a staging temp path in the target directory (same filesystem).
 * 3. Validate the STAGED copy with DB evidence (integrity + schema, incl. actual <= supported).
 * 4. On success, atomically rename staging over the target.
 * 5. Any failure removes staging and leaves the current target untouched.
 *
 * PRECONDITION: the target database must be closed / not actively open. The controlled
 * replacement never overwrites an in-use file in a way that can corrupt it: on Windows,
 * renaming over an open DB fails safely (restore throws, current DB intact).
 * Forward migration after restore is performed by MigrationRunner (not here).
 */
export function restoreBackup(backupFile: string, targetDatabasePath: string): string {
  if (!existsSync(backupFile)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup missing: ${backupFile}`);
  }
  const meta = readBackupMetadata(backupFile);
  if (meta.databaseSchemaVersion > SUPPORTED_DB_SCHEMA_VERSION) {
    throw new PersistenceError(ERROR_CODES.SCHEMA_TOO_NEW, `backup schema ${meta.databaseSchemaVersion} newer than supported ${SUPPORTED_DB_SCHEMA_VERSION}`);
  }
  const staging = join(dirname(targetDatabasePath), `.restore-staging-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite3`);
  try {
    copyFileSync(backupFile, staging);
    validateStagedBackup(staging, meta.databaseSchemaVersion);
    renameSync(staging, targetDatabasePath);
    return targetDatabasePath;
  } catch (e) {
    if (existsSync(staging)) rmSync(staging, { force: true });
    throw e;
  }
}

/**
 * Rotation MECHANISM only (no retention policy): keep the newest maxBackups backups.
 * - maxBackups is a call parameter / test input; NO product default and NO retention
 *   days are defined here (retention cadence = R-06 DATA Decision).
 * - Illegal values (maxBackups < 1) FAIL SAFE: throw, delete nothing.
 * - Removes only backup directories within backupRoot (never domain data).
 * - NOT auto-invoked (no startup/migration/createBackup wiring).
 */
export function rotateBackups(backupRoot: string, maxBackups: number): number {
  if (!Number.isInteger(maxBackups) || maxBackups < 1) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `maxBackups must be >= 1, got ${maxBackups}`);
  }
  const backups = listBackups(backupRoot);
  let removed = 0;
  for (let i = maxBackups; i < backups.length; i++) {
    const dir = backups[i].backupDir;
    assertWithin(backupRoot, dir);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}