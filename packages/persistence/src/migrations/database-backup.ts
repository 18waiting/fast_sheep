// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016) + M1.5-R06 REPAIR: pre-upgrade database backup before any
// existing-data upgrade. WAL-safe consistent committed snapshot.
//
// The persistence architecture runs SQLite in WAL mode (applyPragmas), so a plain
// copy of the main .sqlite3 file would miss un-checkpointed committed WAL content.
// This backup therefore uses SQLite's canonical consistent snapshot primitive
// `VACUUM INTO` (complete, committed, atomic, single-file, safe with active
// connections), then performs a light evidence validation (integrity_check).
//
// Fail-safe: if the pre-upgrade backup cannot produce a valid snapshot, this THROWS,
// so MigrationRunner aborts BEFORE applying any migration and the current database
// keeps its original schema/data. Returns null only when there is no database file
// (nothing to back up).
import { existsSync, mkdirSync, statSync, readdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { DB_FILENAME } from "../db/data-root.js";
import { SqliteConnection } from "../db/sqlite-driver.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";

/** Copy <backupDir>/<timestamp>/<DB_FILENAME> before a migration upgrade. Returns the backup file path or null. */
export function backupDatabase(databasePath: string, backupDir: string): string | null {
  if (!existsSync(databasePath) || statSync(databasePath).size <= 0) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = join(backupDir, stamp);
  mkdirSync(targetDir, { recursive: true });
  const target = join(targetDir, DB_FILENAME);
  const temp = join(targetDir, `.snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    // WAL-safe consistent committed snapshot via SQLite VACUUM INTO
    const src = new SqliteConnection(databasePath);
    try {
      const escaped = temp.replace(/'/g, "''");
      src.exec(`VACUUM INTO '${escaped}'`);
    } finally {
      src.close();
    }
    // light evidence validation: snapshot must open as SQLite with integrity ok
    const check = new SqliteConnection(temp);
    try {
      let integrity: Array<{ integrity_check: string }>;
      try {
        integrity = check.all<{ integrity_check: string }>("PRAGMA integrity_check");
      } catch (e) {
        throw new PersistenceError(ERROR_CODES.ROOT_NOT_WRITABLE, `pre-upgrade backup corrupt: ${(e as Error).message}`);
      }
      if ((integrity[0]?.integrity_check ?? "") !== "ok") {
        throw new PersistenceError(ERROR_CODES.ROOT_NOT_WRITABLE, `pre-upgrade backup corrupt: integrity_check=${integrity[0]?.integrity_check}`);
      }
    } finally {
      check.close();
    }
    renameSync(temp, target);
    return target;
  } catch (e) {
    // clean up partial artifacts; throw so migration does NOT start
    if (existsSync(temp)) rmSync(temp, { force: true });
    if (existsSync(target)) rmSync(target, { force: true });
    if (existsSync(targetDir) && readdirSync(targetDir).length === 0) rmSync(targetDir, { recursive: true, force: true });
    throw e;
  }
}