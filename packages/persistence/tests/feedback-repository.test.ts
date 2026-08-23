import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteFeedbackRepository } from "../dist/index.js";
test("feedback record add/list", () => {
  const { conn } = open();
  const r = new SqliteFeedbackRepository(conn);
  r.add({ record_id: "f1", conversation_id: "c1", class: "MANUAL", trust_level: "HUMAN_CONFIRMED", created_at: "2026-08-15T00:00:00Z" });
  assert.equal(r.list().length, 1);
  assert.equal(r.list()[0].class, "MANUAL");
  conn.close();
});
