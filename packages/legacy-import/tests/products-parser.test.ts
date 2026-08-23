import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProductsCsv } from "../dist/parsers/products-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("products parser splits 主ID and normalizes", () => {
  const rows = parseProductsCsv({ item_id: "i", display_name: "商品库表格.csv", path: join(FIX, "products-csv", "商品库表格.csv"), source_type: "products" });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].product_id, "10001");
  assert.equal(rows[0].title, "合并商品");
});
