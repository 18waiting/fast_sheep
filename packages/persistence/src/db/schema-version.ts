// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016) + M9 (TASK-024): supported DB schema version + compatibility checks (future-schema rejection).
import { PersistenceError, ERROR_CODES } from "./errors.js";

export const SUPPORTED_DB_SCHEMA_VERSION = 5;

export function isSchemaSupported(version: number): boolean {
  return version === SUPPORTED_DB_SCHEMA_VERSION;
}

export function assertSchemaSupported(version: number): void {
  if (version > SUPPORTED_DB_SCHEMA_VERSION) {
    throw new PersistenceError(
      ERROR_CODES.SCHEMA_TOO_NEW,
      `database schema version ${version} is newer than supported ${SUPPORTED_DB_SCHEMA_VERSION}`
    );
  }
}
