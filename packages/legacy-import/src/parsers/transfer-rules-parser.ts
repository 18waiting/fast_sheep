// M11 transfer-rules parser (clean-room). 转接关键字.csv -> TransferRuleRecord;
// migrates legacy `客服来源` column to canonical `来源客服` (GF-STORE-011).
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";
import { parseCsv } from "./csv-utils.js";
import { LegacyImportError, IMPORT_ERROR_CODES } from "../errors.js";

export interface TransferRuleImportRow {
  keyword: string; transfer_to: string; transfer_message: string; work_hours: string;
  source_agent: string; status: string; order_state: string; applicable_shops: string;
}

export function parseTransferRulesCsv(item: SourceItemRef): { rows: TransferRuleImportRow[]; migrated_column: boolean } {
  const table = parseCsv(readFileSync(item.path, "utf-8"));
  if (table.headers.length === 0) throw new LegacyImportError(IMPORT_ERROR_CODES.PARSE_ERROR, "empty transfer CSV");
  const migrated = table.headers.includes("客服来源");
  const rows = table.rows.map((r) => ({
    keyword: String(r["转接关键字"] ?? ""),
    transfer_to: String(r["转接到"] ?? ""),
    transfer_message: String(r["转接时发条消息"] ?? ""),
    work_hours: String(r["工作时间"] ?? ""),
    source_agent: String(r["来源客服"] ?? r["客服来源"] ?? ""),
    status: String(r["状态"] ?? "禁用"),
    order_state: String(r["生效下单状态"] ?? ""),
    applicable_shops: String(r["适用店铺"] ?? ""),
  }));
  return { rows, migrated_column: migrated };
}
