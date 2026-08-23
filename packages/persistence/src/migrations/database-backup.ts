// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): backup the database file before any existing-data upgrade.
import { existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DB_FILENAME } from "../db/data-root.js";

/** Copy <backupDir>/<timestamp>/<DB_FILENAME> before a migration upgrade. Returns the backup file path or null. */
export function backupDatabase(databasePath: string, backupDir: string): string | null {
  if (!existsSync(databasePath) || statSync(databasePath).size <= 0) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = join(backupDir, stamp);
  mkdirSync(targetDir, { recursive: true });
  const target = join(targetDir, DB_FILENAME);
  copyFileSync(databasePath, target);
  return target;
}
