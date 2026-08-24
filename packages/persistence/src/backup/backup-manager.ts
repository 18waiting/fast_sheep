// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1.5-R06: Backup / Restore Foundation (Phase 1 early item of R-06).
// - createBackup REUSES the existing verified backupDatabase snapshot boundary
//   (no second backup implementation). WAL/active-connection consistency follows
//   the same established migration-time backup boundary.
// - restore is fail-safe / atomic: validate backup, stage to temp, integrity+schema
//   check, then atomically replace target; failure never corrupts the current DB.
// - schema compat: backup schema > SUPPORTED -> reject; <= supported -> allowed into
//   restore flow; MigrationRunner performs forward migration (BackupManager never
//   self-upgrades schema).
// - rotateBackups is CAPABILITY ONLY: explicit maxBackups, no production default, no
//   auto-wiring to startup/migration/createBackup (retention cadence = R-06 DATA Gate).
// - Secret exclusion boundary: BackupManager touches only the database file + approved
//   metadata; it never reads/copies SecretStore. Full SecretStore<->backup negative
//   integration is NOT claimed here (comes after R-01).

import { existsSync, writeFileSync, readFileSync, copyFileSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
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

/** List backups under backupRoot, newest first, by their metadata. */
export function listBackups(backupRoot: string): BackupMetadata[] {
  if (!existsSync(backupRoot)) return [];
  const out: BackupMetadata[] = [];
  for (const entry of readdirSync(backupRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(backupRoot, entry.name);
    const metaPath = metadataPathFor(dir);
    if (!existsSync(metaPath)) continue; // incomplete backup -> not listed
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as BackupMetadata;
      if (meta.backupFile && existsSync(meta.backupFile)) out.push(meta);
    } catch {
      // corrupt metadata -> skip listing (restore will reject it)
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

function readBackupMetadata(backupFile: string): BackupMetadata {
  const backupDir = dirname(backupFile);
  const metaPath = metadataPathFor(backupDir);
  if (!existsSync(metaPath)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup incomplete: metadata missing for ${backupFile}`);
  }
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as BackupMetadata;
  } catch {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `backup corrupt: unreadable metadata for ${backupFile}`);
  }
}

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
  } finally {
    conn.close();
  }
}

/**
 * Fail-safe / atomic restore:
 * 1. Reject if backup schema version > SUPPORTED_DB_SCHEMA_VERSION.
 * 2. Copy backup to a staging temp path; run integrity_check + schema validation there.
 * 3. On success, atomically rename staging over the target. Failure leaves the target untouched.
 * Forward migration after restore is performed by MigrationRunner (not here).
 * PRECONDITION: the target database must not be actively open by another connection.
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
    renameSync(staging, targetDatabasePath); // atomic replace on same filesystem
    return targetDatabasePath;
  } catch (e) {
    if (existsSync(staging)) rmSync(staging, { force: true });
    throw e;
  }
}

/**
 * Rotation CAPABILITY ONLY: keep the newest maxBackups backups under backupRoot.
 * - maxBackups must be provided (>= 1); no production default here.
 * - Removes only backup directories (never domain data).
 * - NOT auto-invoked (retention cadence/count = R-06 DATA Decision).
 */
export function rotateBackups(backupRoot: string, maxBackups: number): number {
  if (!Number.isInteger(maxBackups) || maxBackups < 1) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `maxBackups must be >= 1, got ${maxBackups}`);
  }
  const backups = listBackups(backupRoot);
  let removed = 0;
  for (let i = maxBackups; i < backups.length; i++) {
    const dir = backups[i].backupDir;
    if (dir.startsWith(backupRoot) && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}