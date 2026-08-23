import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqlitePromptRepository } from "../dist/index.js";
test("prompt CRUD + mounted_skills round-trip", () => {
  const { conn } = open();
  const r = new SqlitePromptRepository(conn);
  r.save({ id: "p1", title: "默认", content: "<PROMPT_CONTENT>", order_status_binding: "未下单", mounted_skills: ["a"] });
  r.save({ id: "p1", title: "默认", content: "<PROMPT_CONTENT>", order_status_binding: "已下单", mounted_skills: ["a", "b"] });
  assert.deepEqual(r.get("p1").mounted_skills, ["a", "b"]);
  assert.equal(r.get("p1").order_status_binding, "已下单");
  r.remove("p1");
  assert.equal(r.get("p1"), undefined);
  conn.close();
});
