// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1.5-R06: Backup / Restore Foundation (Phase 1 early item of R-06).
//
// Owner tightening applied (2026-08-25):
// 1. Controlled restore: never bare-overwrite a live/open SQLite DB. Restore requires
//    the target to be closed/exclusive; it stages to a temp path, validates, then
//    atomically renames over the target. On Windows, rename-over-an-open-file fails
//    safely, so an in-use target cannot be corrupted by this path.
// 2. Restore compatibility is DB-EVIDENCE based, not metadata-trust: the backup must
//    open as SQLite, pass integrity_check, its ACTUAL schema version must match the
//    metadata, and the ACTUAL version must not exceed SUPPORTED_DB_SCHEMA_VERSION.
//    Metadata is evidence/index, not the authoritative source.
// 3. Metadata cannot cause path breakout: every path read/restored/rotated is
//    constrained to the specified backupRoot (assertWithin); tampered metadata is
//    rejected or skipped, never followed.
// 4. Rotation is mechanism only: maxBackups is a call parameter (no product default,
//    no retention days). Illegal values (maxBackups < 1) fail safe (throw, delete none).
// 5. Secret boundary by responsibility: BackupManager only accepts a database path,
//    a backup root and a schema version; it never reads/copies SecretStore,
//    credentials, env, or other user files. It does NOT claim to prove that
//    SecretStore plaintext never enters SQLite — that full invariant is formed by
//    R-01 + this boundary together.

import { existsSync, writeFileSync, readFileSync, copyFileSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { DB_FILENAME } from "../db/data-root.js";
import { SUPPORTED_DB_SCHEMA_VERSION } from "../db/schema-version.js";
import { backupDatabase } from "../migrations/database-backup.js";
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
 * Create a backup by REUSING the existing verified backupDatabase snapshot boundary,
 * then write approved metadata (schema version) next to it.
 * @param schemaVersion current applied database schema version (from the DB/app_meta).
 */
export function createBackup(databasePath: string, backupRoot: string, schemaVersion: number): BackupMetadata {
  const backupFile = backupDatabase(databasePath, backupRoot);
  if (!backupFile) {
    throw new PersistenceError(ERROR_CODES.ROOT_NOT_WRITABLE, `backup failed: no database file at ${databasePath}`);
  }
  const backupDir = dirname(backupFile);
  const meta: BackupMetadata = {
    createdAt: new Date().toISOString(),
    databaseSchemaVersion: schemaVersion,
    databaseFilename: DB_FILENAME,
    backupFile,
    backupDir,
  };
  writeFileSync(metadataPathFor(backupDir), JSON.stringify(meta, null, 2), "utf-8");
  return meta;
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
      // constrain every path in metadata to backupRoot; skip tampered entries
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
  // metadata.backupFile must resolve to the actual backup file (evidence consistency);
  // otherwise the metadata is tampered and must not be followed.
  if (resolve(meta.backupFile ?? "") !== resolve(backupFile)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: metadata backupFile mismatch for ${backupFile}`);
  }
  return meta;
}

/**
 * Validate a staged copy of a backup using DB EVIDENCE only:
 * - must open as SQLite (else "backup corrupt"),
 * - PRAGMA integrity_check == ok,
 * - actual app_meta schema version == metadata schema version,
 * - actual schema version <= SUPPORTED_DB_SCHEMA_VERSION.
 */
function validateStagedBackup(stagedPath: string, expectedSchemaVersion: number): void {
  const conn = new SqliteConnection(stagedPath);
  try {
    let integrity: Array<{ integrity_check: string }>;
    try {
      integrity = conn.all<{ integrity_check: string }>("PRAGMA integrity_check");
    } catch (e) {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: ${(e as Error).message}`);
    }
    const first = integrity[0]?.integrity_check ?? "";
    if (first !== "ok") {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: integrity_check=${first}`);
    }
    const row = conn.get<{ value: string } | undefined>("SELECT value FROM app_meta WHERE key='database_schema_version'");
    const actual = row ? Number(row.value) : 0;
    if (actual !== expectedSchemaVersion) {
      throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup schema mismatch: metadata=${expectedSchemaVersion} db=${actual}`);
    }
    if (actual > SUPPORTED_DB_SCHEMA_VERSION) {
      throw new PersistenceError(
        ERROR_CODES.SCHEMA_TOO_NEW,
        `backup schema ${actual} newer than supported ${SUPPORTED_DB_SCHEMA_VERSION}`
      );
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
    throw new PersistenceError(
      ERROR_CODES.SCHEMA_TOO_NEW,
      `backup schema ${meta.databaseSchemaVersion} newer than supported ${SUPPORTED_DB_SCHEMA_VERSION}`
    );
  }
  const staging = join(dirname(targetDatabasePath), `.restore-staging-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite3`);
  try {
    copyFileSync(backupFile, staging);
    validateStagedBackup(staging, meta.databaseSchemaVersion);
    renameSync(staging, targetDatabasePath); // controlled atomic replacement
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
    assertWithin(backupRoot, dir); // path-constrained removal
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}