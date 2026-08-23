// M11 shops parser (clean-room). shops.json -> canonical ShopRecord fields.
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";

export interface ShopImportRow { id: string; type: string; name: string; created_time?: string | null; enabled: boolean; order: number }

export function parseShopsJson(item: SourceItemRef): ShopImportRow[] {
  const raw = JSON.parse(readFileSync(item.path, "utf-8")) as unknown;
  const arr = Array.isArray(raw) ? raw : (raw as { shops?: unknown[] }).shops ?? [];
  return arr.map((s, i) => {
    const row = s as Record<string, unknown>;
    return {
      id: String(row.id ?? row["店铺ID"] ?? ""),
      type: String(row.type ?? row.platform ?? ""),
      name: String(row.name ?? row["店铺名称"] ?? ""),
      created_time: row.created_time ? String(row.created_time) : null,
      enabled: Boolean(row.enabled ?? row["启用"] ?? true),
      order: typeof row.order === "number" ? row.order : i,
    };
  });
}
