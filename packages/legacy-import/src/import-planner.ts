// M11 import planner (clean-room). scan -> parse -> validate -> plan.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { ImportPlan, LegacyImportOptions, LegacySourceSelection, ImportConflict, ImportWarning, TimestampPreview } from "./types.js";
import { buildItemManifest } from "./import-manifest.js";
import { buildPlan } from "./import-plan.js";
import { scanSelection } from "./source-scanner.js";
import { convertLegacyTimestamp } from "./timestamp-converter.js";
import { parseCsv } from "./parsers/csv-utils.js";

export async function planImport(
  selection: LegacySourceSelection,
  options: LegacyImportOptions = {},
): Promise<ImportPlan> {
  const items = selection.items.length > 0
    ? selection.items
    : scanSelection(selection.root).items;
  const manifests = [];
  const warnings: ImportWarning[] = [];
  const conflicts: ImportConflict[] = [];
  const timestamps: TimestampPreview[] = [];
  for (const item of items) {
    const manifest = await buildItemManifest(item, selection.selection_id);
    manifests.push(manifest);
    warnings.push(...manifest.warnings);
    for (const c of manifest.conflicts) conflicts.push(c);
    if (item.source_type === "messages" || item.source_type === "knowledge") {
      timestamps.push(...previewTimestamps(item, options.legacy_timezone));
    }
  }
  return buildPlan({
    plan_id: "plan-" + randomUUID().slice(0, 8),
    selection_id: selection.selection_id,
    items: manifests,
    options,
    timestamps,
    warnings,
    conflicts,
  });
}

function previewTimestamps(item: { item_id: string; path: string }, tz?: string): TimestampPreview[] {
  try {
    const table = parseCsv(readFileSync(item.path, "utf-8"));
    const out: TimestampPreview[] = [];
    for (const row of table.rows.slice(0, 5)) {
      const raw = row["时间"] ?? row["created_at"] ?? "";
      if (!raw) continue;
      try {
        const r = convertLegacyTimestamp(raw, tz);
        out.push({ item_id: item.item_id, field: "时间", legacy: raw, converted: r.converted, timezone: r.timezone });
      } catch {
        out.push({ item_id: item.item_id, field: "时间", legacy: raw, converted: "", timezone: tz ?? "UNKNOWN" });
      }
    }
    return out;
  } catch {
    return [];
  }
}
