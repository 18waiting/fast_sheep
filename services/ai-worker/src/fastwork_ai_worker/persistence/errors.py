"""Normalized persistence errors for the clean-room worker (M1).

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts.
"""


class PersistenceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


ERROR_CODES = {
    "NOT_FOUND": "persistence.not_found",
    "VALIDATION": "persistence.validation",
    "CONFLICT": "persistence.conflict",
    "BUSY": "persistence.busy",
    "MIGRATION_FAILED": "persistence.migration_failed",
    "SCHEMA_TOO_NEW": "persistence.schema_too_new",
    "CORRUPT_DATABASE": "persistence.corrupt_database",
    "INVALID_DATA_ROOT": "persistence.invalid_data_root",
    "ROOT_NOT_WRITABLE": "persistence.root_not_writable",
    "DATABASE_MISSING": "persistence.database_missing",
    "WORKER_SCHEMA_UNSUPPORTED": "persistence.worker_schema_unsupported",
    "INVALID_CONFIG": "persistence.invalid_config",
    "MIGRATION_METADATA_CORRUPT": "persistence.migration_metadata_corrupt",
}
