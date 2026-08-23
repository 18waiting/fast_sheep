import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteForbiddenWordRepository } from "../dist/index.js";
test("forbidden word CRUD", () => {
  const { conn } = open();
  const r = new SqliteForbiddenWordRepository(conn);
  r.save({ term: "微信", replacement: "", enabled: true, sort_order: 0 });
  r.save({ term: "拼多多", replacement: "并夕夕", enabled: true, sort_order: 1 });
  assert.equal(r.list().length, 2);
  const w = r.list().find((x) => x.term === "拼多多");
  assert.equal(w.replacement, "并夕夕");
  r.remove(w!.id!);
  assert.equal(r.list().length, 1);
  conn.close();
});
