// M11 import plan (clean-room). Plan carries a plan_sha256; apply recomputes
// the source fingerprint and rejects on mismatch.
import type { ImportItemManifest, ImportPlan, LegacyImportOptions, TimestampPreview, ImportWarning, ImportConflict } from "./types.js";
import { fingerprintString } from "./source-fingerprint.js";

export function planFingerprint(selectionId: string, items: ImportItemManifest[], options: LegacyImportOptions): string {
  const canonical = JSON.stringify({
    selection_id: selectionId,
    items: items.map((i) => ({ item_id: i.item_id, source_type: i.source_type, source_fingerprint: i.source_fingerprint, target_aggregate: i.target_aggregate, record_count: i.record_count })),
    options: { conflict_policy: options.conflict_policy, legacy_timezone: options.legacy_timezone ?? null, import_provider_secret: options.import_provider_secret ?? false, rebuild_rag: options.rebuild_rag ?? true },
  });
  return fingerprintString(canonical);
}

export function buildPlan(input: {
  plan_id: string;
  selection_id: string;
  items: ImportItemManifest[];
  options: LegacyImportOptions;
  timestamps: TimestampPreview[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}): ImportPlan {
  return {
    plan_id: input.plan_id,
    selection_id: input.selection_id,
    plan_sha256: planFingerprint(input.selection_id, input.items, input.options),
    items: input.items,
    options: input.options,
    timestamps: input.timestamps,
    warnings: input.warnings,
    conflicts: input.conflicts,
    secret_fields_detected: unique(input.items.flatMap((i) => i.secret_fields_detected)),
    created_at: new Date().toISOString(),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
