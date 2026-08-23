// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): injectable data root (FASTWORK_DATA_DIR) + directory provisioning.
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, isAbsolute, normalize } from "node:path";
import { PersistenceError, ERROR_CODES } from "./errors.js";

// SHEEP-005 Business Data Root Isolation:
// - Default data root: %LOCALAPPDATA%\fast_sheep\data (win32), ~/.fast_sheep/data (other)
// - Legacy compatibility: FASTWORK_DATA_DIR remains the supported override env var
//   (kept for existing scripts/tests/tooling; renaming requires a dedicated migration task).
export const DATA_ROOT_ENV = "FASTWORK_DATA_DIR";
export const DB_FILENAME = "fast_sheep.sqlite3";

export interface DataRoot {
  root: string;
  databasePath: string;
  backupDir: string;
  logsDir: string;
  skillsDir: string;
  derivedDir: string;
}

export function resolveDataRoot(override?: string): string {
  const chosen = override?.trim() || process.env[DATA_ROOT_ENV]?.trim() || platformDefaultDataRoot();
  if (!isAbsolute(chosen)) {
    throw new PersistenceError(ERROR_CODES.INVALID_DATA_ROOT, `data root must be absolute: ${chosen}`);
  }
  return normalize(resolve(chosen));
}

function platformDefaultDataRoot(): string {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    return join(base, "fast_sheep", "data");
  }
  return join(homedir(), ".fast_sheep", "data");
}

/** Provision required directories and expose the canonical database + backup paths. */
export function provisionDataRoot(root: string): DataRoot {
  const backupDir = join(root, "backups", "db");
  const logsDir = join(root, "logs");
  const skillsDir = join(root, "skills");
  const derivedDir = join(root, "derived");
  for (const d of [backupDir, logsDir, skillsDir, derivedDir]) mkdirSync(d, { recursive: true });
  try {
    const probe = join(root, ".probe");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
  } catch {
    throw new PersistenceError(ERROR_CODES.ROOT_NOT_WRITABLE, `data root not writable: ${root}`);
  }
  return { root, databasePath: join(root, DB_FILENAME), backupDir, logsDir, skillsDir, derivedDir };
}
