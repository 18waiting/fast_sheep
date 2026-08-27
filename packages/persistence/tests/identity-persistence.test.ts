// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-A: identity domain persistence — migration paths + repositories.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository,
  SqliteMemberRepository, SqliteMembershipRepository, SqliteSeatRepository,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-idt-")); }
function sha256(path: string): string { return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex"); }

const LEGACY = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql"];

function copyRange(target: string, names: string[]): void {
  for (const f of names) copyFileSync(join(MIGRATIONS_DIR, f), join(target, f));
}

test("fresh DB: migrates to schema v8, new identity tables + legacy tables coexist", () => {
  const r = root();
  const { conn, schemaVersion } = openDatabase(r);
  assert.equal(schemaVersion, 8);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 8);
  for (const t of ["merchants","stores","platform_accounts","members","memberships","seats"]) {
    assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", t), `table ${t}`);
  }
  for (const t of ["shops","products","conversations","conversation_messages"]) {
    assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", t), `legacy table ${t} coexists`);
  }
  conn.close();
});

test("upgrade path: 0001-0004 DB migrates to 0005/0006/0007/0008; historical checksums unchanged; backup created", () => {
  const r = root();
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  const mig4 = mkdtempSync(join(tmpdir(), "fs-mig4-"));
  copyRange(mig4, LEGACY);
  const runner4 = new MigrationRunner(mig4);
  const res4 = runner4.migrate(conn, join(r, "backups", "db"));
  assert.equal(res4.migratedCount, 4);
  assert.equal(conn.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "4");

  const runner = new MigrationRunner();
  const res = runner.migrate(conn, join(r, "backups", "db"));
  assert.equal(res.migratedCount, 4);
  assert.equal(res.backedUp, true, "backup safety mechanism must run for pending migration");

  const applied = runner.applied(conn);
  for (const f of LEGACY) {
    const v = Number(f.match(/^(\d+)_/)?.[1]);
    const row = applied.find((a) => a.version === v);
    assert.ok(row, `record for ${f} (version ${v})`);
    assert.equal(row.checksum, sha256(join(MIGRATIONS_DIR, f)), `checksum unchanged: ${f}`);
  }
  conn.close();
});

test("failure rollback: a failing migration does not partially apply", () => {
  const r = root();
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  const bad = mkdtempSync(join(tmpdir(), "fs-bad-"));
  copyRange(bad, LEGACY);
  writeFileSync(join(bad, "0005_broken.sql"), "CREATE TABLE should_not_exist (id TEXT); THIS IS NOT SQL;");
  const runner = new MigrationRunner(bad);
  assert.throws(() => runner.migrate(conn, join(r, "backups", "db")));
  assert.equal(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'"), undefined, "no partial table");
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 4, "only 0001-0004 recorded");
  conn.close();
});

test("members table has NO merchant_id (single ownership source = memberships)", () => {
  const r = root();
  const { conn } = openDatabase(r);
  const names = conn.all<{ name: string }>("PRAGMA table_info(members)").map((c) => c.name);
  assert.ok(names.includes("id"));
  assert.ok(names.includes("account_ref_kind"));
  assert.ok(!names.includes("merchant_id"), "members must not hold merchant ownership");
  conn.close();
});

test("identity repositories: merchant/store/platformAccount/member/membership/seat CRUD + merchant-scoped lists", () => {
  const r = root();
  const { conn } = openDatabase(r);
  const merchants = new SqliteMerchantRepository(conn);
  const stores = new SqliteStoreRepository(conn);
  const pas = new SqlitePlatformAccountRepository(conn);
  const members = new SqliteMemberRepository(conn);
  const memberships = new SqliteMembershipRepository(conn);
  const seats = new SqliteSeatRepository(conn);

  merchants.save({ id: "m1", name: "测试商户" });
  assert.deepEqual(merchants.findById("m1"), { id: "m1", name: "测试商户" });
  assert.equal(merchants.findById("nope"), null);

  merchants.save({ id: "m2", name: "商户二" });
  stores.save({ id: "s1", merchantId: "m1", name: "PDD 店", platform: "pdd" });
  stores.save({ id: "s2", merchantId: "m2", name: "抖店", platform: "doudian" });
  assert.deepEqual(stores.listByMerchant("m1").map((s) => s.id), ["s1"]);
  assert.equal(stores.findById("s1")?.platform, "pdd");

  pas.save({ id: "pa1", merchantId: "m1", platform: "pdd", externalRef: "ext-1" });
  assert.deepEqual(pas.listByMerchant("m1").map((p) => p.id), ["pa1"]);
  assert.equal(pas.findById("pa1")?.externalRef, "ext-1");

  members.save({ id: "mem1", accountRefKind: "local", accountRefValue: "acc-1" });
  assert.deepEqual(members.findById("mem1"), { id: "mem1", accountRefKind: "local", accountRefValue: "acc-1" });

  memberships.save({ id: "ms1", merchantId: "m1", memberId: "mem1", role: "owner" });
  memberships.save({ id: "ms2", merchantId: "m2", memberId: "mem1", role: "agent" });
  assert.deepEqual(memberships.listByMerchant("m1").map((m) => m.id), ["ms1"]);
  assert.deepEqual(memberships.listByMember("mem1").map((m) => m.id).sort(), ["ms1", "ms2"]);

  seats.save({ id: "seat1", merchantId: "m1" });
  assert.deepEqual(seats.listByMerchant("m1").map((s) => s.id), ["seat1"]);

  conn.close();
});

test("repositories expose NO delete/remove/tombstone operations", () => {
  const r = root();
  const { conn } = openDatabase(r);
  const instances = [
    new SqliteMerchantRepository(conn), new SqliteStoreRepository(conn),
    new SqlitePlatformAccountRepository(conn), new SqliteMemberRepository(conn),
    new SqliteMembershipRepository(conn), new SqliteSeatRepository(conn),
  ];
  for (const inst of instances) {
    for (const name of ["delete", "remove", "hardDelete", "tombstone"]) {
      assert.equal(typeof (inst as Record<string, unknown>)[name], "undefined", `no ${name}`);
    }
  }
  conn.close();
});
