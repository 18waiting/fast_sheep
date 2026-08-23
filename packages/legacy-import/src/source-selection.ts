// M11 explicit source selection (clean-room). The user explicitly selects files;
// no automatic discovery of legacy installation/userData directories.
import { basename, extname, join, resolve } from "node:path";
import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { LegacySourceSelection, SourceItemRef, SourceType } from "./types.js";
import { assertInsideRoot, assertNoSymlinkEscape } from "./path-safety.js";
import { LegacyImportError, IMPORT_ERROR_CODES } from "./errors.js";

/** Map a selected file path to a source type by known legacy filename. */
export function sourceTypeForPath(path: string): SourceType {
  const name = basename(path);
  if (name === "shops.json") return "shops";
  if (name === "Fastkey.json") return "fastkey";
  if (name === "协同.json") return "settings";
  if (name === "高阶设置.json") return "settings";
  if (name === "AI高级配置.json" || name === "ai_settings.json") return "ai_settings";
  if (name === "提示词.json") return "prompts";
  if (name === "违禁词.json") return "forbidden_words";
  if (name === "转接关键字.csv") return "transfer_rules";
  if (name === "商品库表格.csv" || name === "商品库.csv") return "products";
  if (name === "消息记录.csv") return "messages";
  if (name === "SKILL.md") return "skills";
  if (name === "商品技能挂载.json") return "skill_mounts";
  if (name.includes("全自动收录") || name.includes("人工确认") || name.includes("待审核")) return "knowledge";
  if (name.endsWith(".csv")) return "knowledge";
  return EXT_SOURCE_TYPE[extname(path).toLowerCase()] ?? "settings";
}

const EXT_SOURCE_TYPE: Record<string, SourceType> = { ".json": "settings", ".csv": "knowledge" };

/** Build an explicit selection from user-chosen absolute file paths. */
export function createSelection(root: string, chosenFiles: string[]): LegacySourceSelection {
  const rootResolved = resolve(root);
  assertNoSymlinkEscape(rootResolved, rootResolved);
  const items: SourceItemRef[] = [];
  const seen = new Set<string>();
  for (const file of chosenFiles) {
    const abs = resolve(file);
    assertInsideRoot(rootResolved, abs);
    assertNoSymlinkEscape(rootResolved, abs);
    if (!statSync(abs, { throwIfNoEntry: false })) {
      throw new LegacyImportError(IMPORT_ERROR_CODES.INVALID_SOURCE, "selected file missing: " + abs);
    }
    if (!statSync(abs).isFile()) {
      throw new LegacyImportError(IMPORT_ERROR_CODES.INVALID_SOURCE, "selected path is not a file: " + abs);
    }
    const type = sourceTypeForPath(abs);
    const key = type + ":" + abs;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ item_id: "it-" + randomUUID().slice(0, 8), display_name: basename(abs), path: abs, source_type: type });
  }
  return { selection_id: "sel-" + randomUUID().slice(0, 8), root: rootResolved, items, selected_at: new Date().toISOString() };
}

/** Rebuild a selection from opaque stored references (no filesystem authority leak). */
export function selectionFromRefs(root: string, refs: SourceItemRef[]): LegacySourceSelection {
  return {
    selection_id: "sel-" + randomUUID().slice(0, 8),
    root: resolve(root),
    items: refs.map((r) => ({ ...r, path: join(resolve(root), r.path) })),
    selected_at: new Date().toISOString(),
  };
}
