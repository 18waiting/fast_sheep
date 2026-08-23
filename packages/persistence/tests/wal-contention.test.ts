import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

test("WAL contention is bounded by busy_timeout (no infinite block)", () => {
  const r = root();
  const a = openDatabase(r, { seed: false }).conn;
  a.transaction(() => {
    a.run("INSERT INTO shops (id, type, name, enabled, sort_order) VALUES ('s1','pdd','店',1,0)");
    const b = new SqliteConnection(join(r, DB_FILENAME));
    const started = Date.now();
    assert.throws(() => b.run("INSERT INTO shops (id, type, name, enabled, sort_order) VALUES ('s2','pdd','店2',1,0)"), (e) => /busy|locked/i.test(String(e.message)));
    assert.ok(Date.now() - started < 5000, "busy attempt must terminate quickly");
    b.close();
  });
  a.close();
});
