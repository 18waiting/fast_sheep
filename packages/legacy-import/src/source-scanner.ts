// M11 source scanner (clean-room). Bounded scan of an explicitly selected root for
// known legacy files. Only explicitly selected roots are ever read.
import { readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { SourceItemRef, SourceType } from "./types.js";
import { sourceTypeForPath } from "./source-selection.js";
import { assertInsideRoot, assertNoSymlinkEscape, type PathSafetyLimits, DEFAULT_SAFETY_LIMITS } from "./path-safety.js";
import { LegacyImportError, IMPORT_ERROR_CODES } from "./errors.js";

const KNOWN_FILES = new Set([
  "shops.json", "Fastkey.json", "协同.json", "高阶设置.json", "AI高级配置.json",
  "ai_settings.json", "提示词.json", "违禁词.json", "转接关键字.csv", "商品库表格.csv",
  "商品库.csv", "消息记录.csv", "商品技能挂载.json", "SKILL.md",
]);

export interface ScanResult {
  items: SourceItemRef[];
  file_count: number;
}

function walk(dir: string, root: string, out: string[], limits: PathSafetyLimits): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  if (out.length + entries.length > limits.maxFiles) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.INVALID_SOURCE, "selection exceeds maxFiles limit");
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    assertInsideRoot(root, abs);
    if (entry.isSymbolicLink()) {
      assertNoSymlinkEscape(root, abs);
    }
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(abs, root, out, limits);
    } else if (entry.isFile()) {
      const st = statSync(abs);
      if (st.size > limits.maxFileBytes) {
        throw new LegacyImportError(IMPORT_ERROR_CODES.INVALID_SOURCE, "file exceeds maxFileBytes: " + abs);
      }
      out.push(abs);
    }
  }
}

export function scanSelection(root: string, limits: PathSafetyLimits = DEFAULT_SAFETY_LIMITS): ScanResult {
  const rootResolved = resolve(root);
  if (!statSync(rootResolved, { throwIfNoEntry: false })) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.INVALID_SOURCE, "selection root missing: " + rootResolved);
  }
  const files: string[] = [];
  walk(rootResolved, rootResolved, files, limits);
  const items: SourceItemRef[] = [];
  for (const f of files) {
    const name = basename(f);
    if (!KNOWN_FILES.has(name) && !name.endsWith(".csv")) continue;
    const type: SourceType = sourceTypeForPath(f);
    items.push({ item_id: "it-" + items.length.toString(36), display_name: name, path: f, source_type: type });
  }
  return { items, file_count: files.length };
}
