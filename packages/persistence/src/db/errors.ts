// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): normalized persistence errors. Raw SQLite errors are never exposed as public errors.

export class PersistenceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const ERROR_CODES = {
  NOT_FOUND: "persistence.not_found",
  VALIDATION: "persistence.validation",
  CONFLICT: "persistence.conflict",
  BUSY: "persistence.busy",
  MIGRATION_FAILED: "persistence.migration_failed",
  MIGRATION_CHECKSUM_MISMATCH: "persistence.migration_checksum_mismatch",
  SCHEMA_TOO_NEW: "persistence.schema_too_new",
  CORRUPT_DATABASE: "persistence.corrupt_database",
  INVALID_DATA_ROOT: "persistence.invalid_data_root",
  ROOT_NOT_WRITABLE: "persistence.root_not_writable",
  DATABASE_MISSING: "persistence.database_missing",
  WORKER_SCHEMA_UNSUPPORTED: "persistence.worker_schema_unsupported",
  INVALID_CONFIG: "persistence.invalid_config",
  MIGRATION_METADATA_CORRUPT: "persistence.migration_metadata_corrupt",
  WORKSPACE_IDENTITY: "persistence.workspace_identity",
} as const;

export function notFound(message = "record not found"): PersistenceError {
  return new PersistenceError(ERROR_CODES.NOT_FOUND, message);
}

