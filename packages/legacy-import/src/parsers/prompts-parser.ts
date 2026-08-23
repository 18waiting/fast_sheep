// M11 prompts parser (clean-room). 提示词.json -> prompt_profiles + active ids.
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";

export interface PromptImportRow { id: string; title: string; content: string; order_status_binding: string; mounted_skills: string[] }

export interface PromptsImportResult {
  prompts: PromptImportRow[];
  active_ids: Record<string, string>;
}

export function parsePromptsJson(item: SourceItemRef): PromptsImportResult {
  const raw = JSON.parse(readFileSync(item.path, "utf-8")) as Record<string, unknown>;
  const prompts = (raw["prompts"] ?? []) as Array<Record<string, unknown>>;
  const runtime = (raw["运行时状态"] ?? {}) as Record<string, unknown>;
  const rows: PromptImportRow[] = prompts.map((p) => ({
    id: String(p.id ?? ""),
    title: String(p.title ?? ""),
    content: String(p.content ?? ""),
    order_status_binding: "all",
    mounted_skills: Array.isArray(p.mounted_skills) ? p.mounted_skills.map(String) : [],
  }));
  const active_ids: Record<string, string> = {};
  if (runtime["未下单ID"]) active_ids["未下单"] = String(runtime["未下单ID"]);
  if (runtime["已下单ID"]) active_ids["已下单"] = String(runtime["已下单ID"]);
  return { prompts: rows, active_ids };
}
