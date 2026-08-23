import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteShopRepository, SqliteProductRepository, SqliteConversationRepository } from "../dist/index.js";
test("database survives close/reopen (durability across aggregates)", () => {
  const r = root();
  const a = openDatabase(r);
  new SqliteShopRepository(a.conn).add({ id: "shop-1", type: "pdd", name: "店", enabled: true, order: 0 });
  new SqliteProductRepository(a.conn).save({ product_id: "10001", title: "T", detail: "D", shop: "pdd-店", note: "" });
  new SqliteConversationRepository(a.conn).appendMessage({ message_id: "m1", conversation_id: "c1", shop_id: "shop-1", platform: "pdd", buyer: "b", type: "text", content: "hi", role: "buyer", created_at: "2026-08-15T00:00:00Z" });
  a.conn.close();
  const b = openDatabase(r);
  assert.equal(new SqliteShopRepository(b.conn).list().length, 1);
  assert.equal(new SqliteProductRepository(b.conn).get("10001").title, "T");
  assert.equal(new SqliteConversationRepository(b.conn).listMessages("c1").length, 1);
  b.conn.close();
});

test("performance sanity: 1000 conversation messages", () => {
  const { conn } = open();
  const repo = new SqliteConversationRepository(conn);
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    repo.appendMessage({ message_id: `m${i}`, conversation_id: "c1", shop_id: "s1", platform: "pdd", buyer: "b", type: "text", content: `msg ${i}`, role: "buyer", created_at: `2026-08-15T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z` });
  }
  assert.equal(repo.listMessages("c1", 2000).length, 1000);
  assert.ok(Date.now() - t0 < 15000, "1000 message inserts too slow");
  conn.close();
});
