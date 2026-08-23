import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteStatsRepository } from "../dist/index.js";
test("stats generic counter set/get", () => {
  const { conn } = open();
  const r = new SqliteStatsRepository(conn);
  r.set("dialog_count", { today: 3 });
  assert.deepEqual(r.get("dialog_count"), { today: 3 });
  r.set("dialog_count", { today: 4 });
  assert.deepEqual(r.get("dialog_count"), { today: 4 });
  conn.close();
});
