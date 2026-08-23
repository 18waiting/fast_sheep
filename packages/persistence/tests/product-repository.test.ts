import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteProductRepository } from "../dist/index.js";
test("product create/read/update/delete", () => {
  const { conn } = open();
  const r = new SqliteProductRepository(conn);
  r.save({ product_id: "10001", title: "T恤", detail: "纯棉", shop: "pdd-店", note: "" });
  assert.equal(r.get("10001").title, "T恤");
  r.save({ product_id: "10001", title: "T恤2", detail: "纯棉2", shop: "pdd-店", note: "n" });
  assert.equal(r.get("10001").detail, "纯棉2");
  r.remove("10001");
  assert.equal(r.get("10001"), undefined);
  conn.close();
});
test("product injected-failure atomicity (rollback leaves no row)", () => {
  const { conn } = open();
  const r = new SqliteProductRepository(conn);
  assert.throws(() => conn.transaction(() => {
    r.save({ product_id: "10002", title: "x", detail: "d", shop: "s", note: "" });
    throw new Error("injected");
  }));
  assert.equal(r.get("10002"), undefined);
  conn.close();
});
test("product applyDetail changes only detail; close/reopen durable", () => {
  const r = root();
  const a = openDatabase(r);
  const ra = new SqliteProductRepository(a.conn);
  ra.save({ product_id: "10003", title: "T", detail: "D", shop: "s", note: "" });
  assert.equal(ra.applyDetail("10003", "新详情"), true);
  assert.equal(ra.get("10003").title, "T");
  a.conn.close();
  const b = openDatabase(r);
  assert.equal(new SqliteProductRepository(b.conn).get("10003").detail, "新详情");
  b.conn.close();
});
