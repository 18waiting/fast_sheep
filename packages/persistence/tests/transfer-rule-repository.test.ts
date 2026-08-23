import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteTransferRuleRepository } from "../dist/index.js";
test("transfer rule CRUD + ordering + enable", () => {
  const { conn } = open();
  const r = new SqliteTransferRuleRepository(conn);
  r.save({ keyword: "退款", transfer_to: "售后", transfer_message: "", work_hours: "08:00-23:00", source_agent: "", status: "生效", order_state: "", applicable_shops: "", sort_order: 1, enabled: true });
  r.save({ keyword: "人工", transfer_to: "客服", transfer_message: "", work_hours: "", source_agent: "", status: "生效", order_state: "", applicable_shops: "", sort_order: 2, enabled: false });
  const rows = r.list();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].keyword, "退款");
  assert.equal(rows[1].enabled, false);
  r.remove(rows[0].id!);
  assert.equal(r.list().length, 1);
  conn.close();
});
