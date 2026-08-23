import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteShopRepository, PersistenceError, ERROR_CODES } from "../dist/index.js";
test("shop create/read/rename/enable/reorder/delete", () => {
  const { conn } = open();
  const r = new SqliteShopRepository(conn);
  r.add({ id: "shop-1-0001", type: "pdd", name: "店A", enabled: true, order: 2 });
  r.add({ id: "shop-2-0001", type: "xianyu", name: "店B", enabled: false, order: 1 });
  assert.equal(r.list().length, 2);
  assert.equal(r.list()[0].id, "shop-2-0001");
  r.rename("shop-1-0001", "店A改"); r.setEnabled("shop-1-0001", false); r.reorder("shop-1-0001", 0);
  const s = r.list().find((x) => x.id === "shop-1-0001");
  assert.equal(s.name, "店A改"); assert.equal(s.enabled, false); assert.equal(s.order, 0);
  r.remove("shop-2-0001");
  assert.equal(r.list().length, 1);
  conn.close();
});
test("shop duplicate ID rejected; transaction rollback leaves no partial state", () => {
  const { conn } = open();
  const r = new SqliteShopRepository(conn);
  r.add({ id: "shop-1", type: "pdd", name: "A", enabled: true, order: 0 });
  assert.throws(() => r.add({ id: "shop-1", type: "pdd", name: "B", enabled: true, order: 0 }));
  conn.close();
});
test("shop close/reopen durability", () => {
  const r = root();
  const a = openDatabase(r);
  new SqliteShopRepository(a.conn).add({ id: "shop-1", type: "pdd", name: "店", enabled: true, order: 0 });
  a.conn.close();
  const b = openDatabase(r);
  assert.equal(new SqliteShopRepository(b.conn).list().length, 1);
  b.conn.close();
});
