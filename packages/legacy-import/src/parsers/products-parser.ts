// M11 products parser (clean-room). 商品库表格.csv (5 cols) -> ProductRecord rows;
// 主ID normalization splits `主ID|附属ID`.
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";
import { parseCsv } from "./csv-utils.js";
import { LegacyImportError, IMPORT_ERROR_CODES } from "../errors.js";

export interface ProductImportRow { product_id: string; title: string; detail: string; shop: string; note: string }

export function parseProductsCsv(item: SourceItemRef): ProductImportRow[] {
  const table = parseCsv(readFileSync(item.path, "utf-8"));
  if (table.headers.length === 0) throw new LegacyImportError(IMPORT_ERROR_CODES.PARSE_ERROR, "empty product CSV");
  return table.rows.map((r) => {
    const rawId = String(r["商品Id"] ?? r["商品ID"] ?? "");
    return {
      product_id: rawId.split("|")[0],
      title: String(r["宝贝标题"] ?? r["商品标题"] ?? ""),
      detail: String(r["商品详情"] ?? ""),
      shop: String(r["所属店铺"] ?? ""),
      note: String(r["备注"] ?? ""),
    };
  });
}
