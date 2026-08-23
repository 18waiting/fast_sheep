// M11 legacy import types (clean-room).
export type SourceType =
  | "shops" | "settings" | "fastkey" | "ai_settings" | "products" | "knowledge"
  | "candidates" | "prompts" | "skills" | "skill_mounts" | "transfer_rules"
  | "forbidden_words" | "messages";

export type TargetAggregate =
  | "shops" | "config_groups" | "products" | "knowledge_entries"
  | "knowledge_candidates" | "prompt_profiles" | "skills"
  | "product_skill_mounts" | "transfer_rules" | "forbidden_words" | "conversations";

export type TargetWriter = "main" | "worker" | "derived";

export type ConflictPolicy = "PRESERVE_EXISTING" | "INSERT_MISSING" | "MERGE_SAFE_FIELDS" | "REPLACE_SELECTED";

export type ImportPhase =
  | "SELECT" | "SCAN" | "PARSE" | "VALIDATE" | "PLAN" | "DRY_RUN" | "APPLY_REQUEST"
  | "BACKUP" | "MAIN_WRITE" | "WORKER_WRITE" | "DERIVED_REBUILD" | "VERIFY"
  | "COMPLETE" | "FAILED" | "CANCELLED";

export type SessionState =
  | "MAIN_PREPARED" | "MAIN_APPLIED" | "WORKER_APPLIED" | "DERIVED_REBUILT"
  | "VERIFIED" | "COMPLETED" | "FAILED_RECOVERABLE";

export interface SourceItemRef {
  item_id: string;
  display_name: string;
  path: string;
  source_type: SourceType;
}

export interface LegacySourceSelection {
  selection_id: string;
  root: string;
  items: SourceItemRef[];
  selected_at: string;
}

export interface SourceFingerprint {
  sha256: string;
  size: number;
  mtime_ms: number;
}

export interface LegacyImportOptions {
  conflict_policy?: ConflictPolicy;
  legacy_timezone?: string;
  import_provider_secret?: boolean;
  rebuild_rag?: boolean;
}

export interface ImportConflict {
  item_id: string;
  identity: string;
  reason: string;
  policy: ConflictPolicy;
}

export interface ImportWarning {
  item_id: string;
  message: string;
}

export interface TimestampPreview {
  item_id: string;
  field: string;
  legacy: string;
  converted: string;
  timezone: string;
}

export interface ImportItemManifest {
  item_id: string;
  selection_id: string;
  display_name: string;
  source_type: SourceType;
  source_fingerprint: SourceFingerprint;
  parser_version: string;
  target_aggregate: TargetAggregate;
  target_writer: TargetWriter;
  record_count: number;
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
  secret_fields_detected: string[];
  apply_action: "insert" | "skip" | "replace" | "merge";
  provenance: string;
}

export interface ImportPlan {
  plan_id: string;
  selection_id: string;
  plan_sha256: string;
  items: ImportItemManifest[];
  options: LegacyImportOptions;
  timestamps: TimestampPreview[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
  secret_fields_detected: string[];
  created_at: string;
}

export interface ImportSession {
  session_id: string;
  selection_id: string;
  plan_sha256: string;
  state: SessionState;
  phases: ImportPhase[];
  started_at: string;
  completed_at?: string | null;
  backup_id?: string | null;
  error?: string | null;
}

export interface VerificationCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ImportVerification {
  session_id: string;
  checks: VerificationCheck[];
  all_ok: boolean;
}

export interface KnowledgeImportRequest {
  selection_id: string;
  item_id: string;
  rows: Array<{ question: string; answer: string; product_id: string; tags: string[]; library: string }>;
}

export interface KnowledgeImportResult {
  inserted: number;
  skipped_duplicates: number;
  candidates: number;
  trust_map: Record<string, string>;
}
