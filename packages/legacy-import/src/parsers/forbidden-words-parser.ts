// M11 forbidden-words parser (clean-room). 违禁词.json array -> canonical entries.
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";

export interface ForbiddenWordImportRow { term: string; replacement: string }

export function parseForbiddenWordsJson(item: SourceItemRef): ForbiddenWordImportRow[] {
  const raw = JSON.parse(readFileSync(item.path, "utf-8")) as unknown;
  const arr = Array.isArray(raw) ? raw : (raw as { words?: unknown[] }).words ?? [];
  return arr.map((w) => {
    const row = w as Record<string, unknown>;
    return { term: String(row["违禁词"] ?? row.term ?? ""), replacement: String(row["替换为"] ?? row.replacement ?? "") };
  });
}
