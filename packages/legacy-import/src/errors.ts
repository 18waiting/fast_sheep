// M11 legacy import errors (clean-room). Normalized error model (§46).
export const IMPORT_ERROR_CODES = {
  INVALID_SOURCE: "import.invalid_source",
  UNSUPPORTED_FORMAT: "import.unsupported_format",
  PARSE_ERROR: "import.parse_error",
  VALIDATION_ERROR: "import.validation_error",
  SOURCE_CHANGED: "import.source_changed",
  CONFLICT: "import.conflict",
  SECRET_SKIPPED: "import.secret_skipped",
  PATH_UNSAFE: "import.path_unsafe",
  BACKUP_FAILED: "import.backup_failed",
  MAIN_APPLY_FAILED: "import.main_apply_failed",
  WORKER_APPLY_FAILED: "import.worker_apply_failed",
  VERIFY_FAILED: "import.verify_failed",
  CANCELLED: "import.cancelled",
  NOT_SELECTED: "import.not_selected",
  NO_PLAN: "import.no_plan",
  PLAN_MISMATCH: "import.plan_mismatch",
} as const;
export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[keyof typeof IMPORT_ERROR_CODES];
export class LegacyImportError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LegacyImportError";
    this.code = code;
  }
}
