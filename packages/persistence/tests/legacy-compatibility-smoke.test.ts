// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-020: Legacy/Existing Data Compatibility Smoke.
// - Legacy data is SYNTHETIC representative legacy-shaped test data ONLY (no real
//   FastWork/user data; External Reference Access = 0).
// - Core migration expectation: legacy 0001-0004 -> schema v8 (4 -> 8), with
//   intermediate versions verifiable.
// - Includes post-migration reopen smoke and same-ID collision negative test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteShopRepository, SqliteProductRepository, SqliteConversationRepository,
  SqliteNormalizedConversationRepository, SqliteDomainProductRepository,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-lcs-")); }
function sha256(path: string): string { return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex"); }

const LEGACY4 = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql"];

/** Seed SYNTHETIC legacy-shaped test data (no real user data). */
function seedLegacy(conn: SqliteConnection): void {
  conn.run("INSERT INTO shops (id, type, name, created_time, enabled, sort_order) VALUES ('shop-1','pdd','PDD 店',NULL,1,0)");
  conn.run("INSERT INTO shops (id, type, name, created_time, enabled, sort_order) VALUES ('shop-2','doudian','抖店',NULL,1,1)");
  conn.run("INSERT INTO products (product_id, title, detail, shop, note, created_at, updated_at) VALUES ('prod-1','商品甲','','shop-1','','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')");
  conn.run("INSERT INTO conversations (conversation_id, shop_id, buyer, started_at, updated_at, state) VALUES ('conv-1','shop-1','buyer-1','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z','active')");
  conn.run("INSERT INTO conversation_messages (message_id, conversation_id, shop_id, platform, buyer, type, content, role, created_at) VALUES ('msg-1','conv-1','shop-1','pdd','buyer-1','text','你好','buyer','2026-01-01T00:00:01Z')");
  conn.run("INSERT INTO conversation_messages (message_id, conversation_id, shop_id, platform, buyer, type, content, role, created_at) VALUES ('msg-2','conv-1','shop-1','pdd','ai','text','您好','ai','2026-01-01T00:00:02Z')");
  conn.run("INSERT OR IGNORE INTO config_groups (group_name, schema_version, payload_json, updated_at) VALUES ('RAGConfig','1','{}','2026-01-01T00:00:00Z')");
}

test("compat: legacy v4 DB + synthetic data -> v8; data preserved; checksums unchanged; reopen smoke", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const mig4 = mkdtempSync(join(tmpdir(), "fs-leg4-"));
  for (const f of LEGACY4) copyFileSync(join(MIGRATIONS_DIR, f), join(mig4, f));

  const conn = new SqliteConnection(dbPath);
  const res4 = new MigrationRunner(mig4).migrate(conn, join(r, "backups", "db"));
  assert.equal(res4.migratedCount, 4);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 4, "start: 4 migrations (0001-0004)");
  seedLegacy(conn);

  const runner = new MigrationRunner();
  const res = runner.migrate(conn, join(r, "backups", "db"));
  assert.equal(res.migratedCount, 4, "0005+0006+0007+0008 applied");
  assert.equal(res.backedUp, true);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 8, "end: 8 migrations (0001-0008)");
  const appliedVersions = runner.applied(conn).map((a) => a.version).sort((x, y) => x - y);
  assert.deepEqual(appliedVersions, [1, 2, 3, 4, 5, 6, 7, 8], "intermediate versions verifiable");

  // checksums 0001-0004 unchanged
  for (const f of LEGACY4) {
    const v = Number(f.match(/^(\d+)_/)?.[1]);
    const row = runner.applied(conn).find((a) => a.version === v);
    assert.equal(row.checksum, sha256(join(MIGRATIONS_DIR, f)), `checksum unchanged: ${f}`);
  }

  // legacy data preserved
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM shops").c, 2);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM products").c, 1);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM conversations").c, 1);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM conversation_messages").c, 2);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM config_groups").c, 1);
  conn.close();

  // post-migration reopen smoke
  const reopened = openDatabase(r);
  assert.equal(reopened.schemaVersion, 8);
  const shopRepo = new SqliteShopRepository(reopened.conn);
  assert.equal(shopRepo.list().length, 2);
  const prodRepo = new SqliteProductRepository(reopened.conn);
  assert.equal(prodRepo.get("prod-1")?.title, "商品甲");
  const convRepo = new SqliteConversationRepository(reopened.conn);
  assert.equal(convRepo.getConversation("conv-1")?.buyer, "buyer-1");
  assert.equal(convRepo.listMessages("conv-1").length, 2);
  reopened.conn.close();
});

test("compat: fresh v8 — legacy + domain coexist; same text ID collision is isolated per table", () => {
  const r = root();
  const { conn } = openDatabase(r);
  seedLegacy(conn);

  // parent rows for domain FKs
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('m1', 'm')");
  conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES ('s1', 'm1', 's', 'pdd')");
  conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform) VALUES ('pa1', 'm1', 'pdd')");

  // domain rows with the SAME text IDs as legacy rows
  const nconv = new SqliteNormalizedConversationRepository(conn);
  const dprod = new SqliteDomainProductRepository(conn);
  nconv.save({ id: "conv-1", merchantId: "m1", storeId: "s1", platformAccountId: "pa1" });
  dprod.save({ id: "prod-1", merchantId: "m1", platformAccountId: "pa1" });

  // legacy repositories read legacy tables only
  const prodRepo = new SqliteProductRepository(conn);
  assert.equal(prodRepo.get("prod-1")?.title, "商品甲", "legacy product row");
  const convRepo = new SqliteConversationRepository(conn);
  assert.equal(convRepo.getConversation("conv-1")?.buyer, "buyer-1", "legacy conversation row");

  // domain repositories read domain tables only (same text ID -> different rows)
  assert.equal(dprod.findById("prod-1")?.merchantId, "m1", "domain product row");
  assert.equal(nconv.findById("conv-1")?.storeId, "s1", "domain conversation row");

  // domain writes do not touch legacy tables
  const legacyProdCount = conn.get("SELECT COUNT(*) AS c FROM products").c;
  const legacyConvCount = conn.get("SELECT COUNT(*) AS c FROM conversations").c;
  dprod.save({ id: "prod-2", merchantId: "m1", platformAccountId: "pa1" });
  nconv.save({ id: "conv-2", merchantId: "m1", storeId: "s1", platformAccountId: "pa1" });
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM products").c, legacyProdCount, "legacy products untouched");
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM conversations").c, legacyConvCount, "legacy conversations untouched");
  conn.close();
});

