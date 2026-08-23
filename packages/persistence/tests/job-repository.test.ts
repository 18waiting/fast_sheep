import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteJobRepository } from "../dist/index.js";
test("background job create/update/get/list", () => {
  const { conn } = open();
  const r = new SqliteJobRepository(conn);
  r.create({ job_id: "j1", type: "learning", state: "QUEUED", progress: 0, message: "" });
  r.update({ job_id: "j1", type: "learning", state: "RUNNING", progress: 50, message: "going" });
  assert.equal(r.get("j1").state, "RUNNING");
  assert.equal(r.list("RUNNING").length, 1);
  conn.close();
});
