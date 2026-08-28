// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-C: commerce domain persistence — migration paths + repositories.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteCustomerRepository, SqliteDomainProductRepository, SqliteSkuRepository,
  SqliteOrderRepository, SqliteLogisticsRepository,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-cmc-")); }
function sha256(path: string): string { return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex"); }

const THRU_0006 = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql","0005_identity_domain.sql","0006_conversation_domain.sql"];

function copyRange(target: string, names: string[]): void {
  for (const f of names) copyFileSync(join(MIGRATIONS_DIR, f), join(target, f));
}
function seedParents(conn: SqliteConnection, merchantId: string, paId: string): void {
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'm')", merchantId);
  conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform) VALUES (?, ?, 'pdd')", paId, merchantId);
}

test("fresh DB: schema v10, new commerce tables + legacy coexist (products legacy untouched)", () => {
  const r = root();
  const { conn, schemaVersion } = openDatabase(r);
  assert.equal(schemaVersion, 10);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 10);
  for (const t of ["customers","domain_products","skus","orders","logistics"]) {
    assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", t), `table ${t}`);
  }
  assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'"), "legacy products table coexists");
  conn.close();
});

test("upgrade path: 0001-0006 DB migrates to 0007/0008/0009/0010; historical checksums unchanged; backup created", () => {
  const r = root();
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  const mig6 = mkdtempSync(join(tmpdir(), "fs-mig6-"));
  copyRange(mig6, THRU_0006);
  assert.equal(new MigrationRunner(mig6).migrate(conn, join(r, "backups", "db")).migratedCount, 6);

  const runner = new MigrationRunner();
  const res = runner.migrate(conn, join(r, "backups", "db"));
  assert.equal(res.migratedCount, 4);
  assert.equal(res.backedUp, true);

  const applied = runner.applied(conn);
  for (const f of THRU_0006) {
    const v = Number(f.match(/^(\d+)_/)?.[1]);
    const row = applied.find((a) => a.version === v);
    assert.ok(row, `record for ${f}`);
    assert.equal(row.checksum, sha256(join(MIGRATIONS_DIR, f)), `checksum unchanged: ${f}`);
  }
  conn.close();
});

test("failure rollback: a failing migration does not partially apply", () => {
  const r = root();
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  const bad = mkdtempSync(join(tmpdir(), "fs-bad-"));
  copyRange(bad, THRU_0006);
  writeFileSync(join(bad, "0007_broken.sql"), "CREATE TABLE should_not_exist (id TEXT); THIS IS NOT SQL;");
  assert.throws(() => new MigrationRunner(bad).migrate(conn, join(r, "backups", "db")));
  assert.equal(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'"), undefined);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 6);
  conn.close();
});

test("commerce schema: no store_id on customers/domain_products/orders; skus/logistics no merchant_id; no UNIQUE external_ref; no ON DELETE CASCADE", () => {
  const r = root();
  const { conn } = openDatabase(r);
  for (const t of ["customers","domain_products","orders"]) {
    const names = conn.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name);
    assert.ok(!names.includes("store_id"), `${t} must not carry store_id (Store semantics DEFERRED)`);
  }
  for (const t of ["skus","logistics"]) {
    const names = conn.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name);
    assert.ok(!names.includes("merchant_id"), `${t} must not repeat merchant`);
  }
  for (const t of ["customers","domain_products","skus","orders","logistics"]) {
    const ddl = conn.get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE name='${t}'`).sql;
    assert.ok(!/UNIQUE\s*\(\s*external_ref/i.test(ddl), `${t}: no UNIQUE(external_ref)`);
    assert.ok(!/ON\s+DELETE\s+CASCADE/i.test(ddl), `${t}: no ON DELETE CASCADE`);
  }
  conn.close();
});

test("commerce repositories CRUD + scoped lists; SKU/Logistics via product/order single fact source", () => {
  const r = root();
  const { conn } = openDatabase(r);
  seedParents(conn, "m1", "pa1");
  const customers = new SqliteCustomerRepository(conn);
  const products = new SqliteDomainProductRepository(conn);
  const skus = new SqliteSkuRepository(conn);
  const orders = new SqliteOrderRepository(conn);
  const logistics = new SqliteLogisticsRepository(conn);

  customers.save({ id: "c1", merchantId: "m1", platformAccountId: "pa1", externalRef: "ext-c" });
  assert.deepEqual(customers.findById("c1"), { id: "c1", merchantId: "m1", platformAccountId: "pa1", externalRef: "ext-c" });
  assert.deepEqual(customers.listByMerchant("m1").map((c) => c.id), ["c1"]);

  products.save({ id: "p1", merchantId: "m1", platformAccountId: "pa1" });
  products.save({ id: "p2", merchantId: "m1", platformAccountId: "pa1" });
  assert.deepEqual(products.listByMerchant("m1").map((p) => p.id).sort(), ["p1", "p2"]);

  skus.save({ id: "k1", productId: "p1" });
  skus.save({ id: "k2", productId: "p2" });
  assert.deepEqual(skus.listByProduct("p1").map((s) => s.id), ["k1"]);

  orders.save({ id: "o1", merchantId: "m1", platformAccountId: "pa1" });
  assert.deepEqual(orders.listByMerchant("m1").map((o) => o.id), ["o1"]);

  logistics.save({ id: "l1", orderId: "o1", externalRef: "ext-l" });
  assert.deepEqual(logistics.listByOrder("o1").map((l) => l.id), ["l1"]);
  assert.equal(logistics.findById("l1")?.externalRef, "ext-l");

  conn.close();
});

test("merchant scope isolation negative: listByMerchant(A) never returns Merchant B data", () => {
  const r = root();
  const { conn } = openDatabase(r);
  seedParents(conn, "mA", "paA");
  seedParents(conn, "mB", "paB");
  const customers = new SqliteCustomerRepository(conn);
  const products = new SqliteDomainProductRepository(conn);
  const orders = new SqliteOrderRepository(conn);

  customers.save({ id: "ca1", merchantId: "mA", platformAccountId: "paA" });
  customers.save({ id: "cb1", merchantId: "mB", platformAccountId: "paB" });
  products.save({ id: "pa1", merchantId: "mA", platformAccountId: "paA" });
  products.save({ id: "pb1", merchantId: "mB", platformAccountId: "paB" });
  orders.save({ id: "oa1", merchantId: "mA", platformAccountId: "paA" });
  orders.save({ id: "ob1", merchantId: "mB", platformAccountId: "paB" });

  assert.deepEqual(customers.listByMerchant("mA").map((c) => c.id), ["ca1"], "customer A only");
  assert.deepEqual(products.listByMerchant("mA").map((p) => p.id), ["pa1"], "product A only");
  assert.deepEqual(orders.listByMerchant("mA").map((o) => o.id), ["oa1"], "order A only");
  assert.equal(customers.findById("cb1")?.merchantId, "mB");
  conn.close();
});

test("legacy collision negative: DomainProductRepository touches domain_products only, not legacy products", () => {
  const r = root();
  const { conn } = openDatabase(r);
  conn.run("INSERT INTO products (product_id, title, detail, shop, note, created_at, updated_at) VALUES ('legacy-p', 't', '', 'shop-1', '', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')");
  seedParents(conn, "m1", "pa1");
  const products = new SqliteDomainProductRepository(conn);
  assert.equal(products.findById("legacy-p"), null, "legacy product invisible to domain repo");
  products.save({ id: "dp1", merchantId: "m1", platformAccountId: "pa1" });
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM products").c, 1, "legacy products table untouched");
  conn.close();
});

test("repositories expose NO delete operations; no sync fields", () => {
  const r = root();
  const { conn } = openDatabase(r);
  const instances = [
    new SqliteCustomerRepository(conn), new SqliteDomainProductRepository(conn),
    new SqliteSkuRepository(conn), new SqliteOrderRepository(conn), new SqliteLogisticsRepository(conn),
  ];
  for (const inst of instances) {
    for (const name of ["delete","remove","hardDelete","tombstone"]) {
      assert.equal(typeof (inst as Record<string, unknown>)[name], "undefined", `no ${name}`);
    }
  }
  for (const t of ["customers","domain_products","skus","orders","logistics"]) {
    const names = conn.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name);
    for (const k of ["revision","deleted_at","remote_id","last_synced_at","pending_upload"]) {
      assert.ok(!names.includes(k), `${t}: no sync field ${k}`);
    }
  }
  conn.close();
});

