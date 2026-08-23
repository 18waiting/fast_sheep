import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteSkillRepository } from "../dist/index.js";
test("skill CRUD + product mounts", () => {
  const { conn } = open();
  const r = new SqliteSkillRepository(conn);
  r.save({ skill_id: "s1", name: "尺码", enabled: true, asset_path: "skills/s1", signature: "abc" });
  assert.equal(r.get("s1").enabled, true);
  r.mountToProduct("10001", "s1");
  assert.deepEqual(r.listMounts("10001"), ["s1"]);
  r.remove("s1");
  assert.equal(r.get("s1"), undefined);
  assert.deepEqual(r.listMounts("10001"), []);
  conn.close();
});
