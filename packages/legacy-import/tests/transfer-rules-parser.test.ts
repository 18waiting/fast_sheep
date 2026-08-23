import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTransferRulesCsv } from "../dist/parsers/transfer-rules-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("transfer rules parser migrates 客服来源 -> 来源客服 (GF-STORE-011)", () => {
  const r = parseTransferRulesCsv({ item_id: "i", display_name: "转接关键字.csv", path: join(FIX, "handoff-rules", "转接关键字.csv"), source_type: "transfer_rules" });
  assert.equal(r.migrated_column, true);
  assert.equal(r.rows[0].source_agent, "客服1");
});
