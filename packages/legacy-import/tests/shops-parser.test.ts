import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseShopsJson } from "../dist/parsers/shops-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("shops parser maps canonical shop fields", () => {
  const rows = parseShopsJson({ item_id: "i", display_name: "shops.json", path: join(FIX, "full-valid", "shops.json"), source_type: "shops" });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "店铺一");
  assert.equal(rows[0].enabled, true);
});
