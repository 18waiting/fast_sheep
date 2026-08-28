// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-B: conversation domain persistence — migration paths + repositories.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteNormalizedConversationRepository, SqliteMessageRepository, SqliteOwnershipRepository,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-cvt-")); }
function sha256(path: string): string { return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex"); }

const THRU_0005 = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql","0005_identity_domain.sql"];

function copyRange(target: string, names: string[]): void {
  for (const f of names) copyFileSync(join(MIGRATIONS_DIR, f), join(target, f));
}

// Seed parent identity rows required by normalized_conversations FKs.
function seedParents(conn: SqliteConnection, merchantId: string, storeId: string, paId: string): void {
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'm')", merchantId);
  conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES (?, ?, 's', 'pdd')", storeId, merchantId);
  conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform) VALUES (?, ?, 'pdd')", paId, merchantId);
}

test("fresh DB: schema v10, new conversation tables + legacy coexist", () => {
  const r = root();
  const { conn, schemaVersion } = openDatabase(r);
  assert.equal(schemaVersion, 10);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 10);
  for (const t of ["normalized_conversations","normalized_messages","ownership_records"]) {
    assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", t), `table ${t}`);
  }
  for (const t of ["conversations","conversation_messages"]) {
    assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", t), `legacy ${t} coexists`);
  }
  conn.close();
});

test("upgrade path: 0001-0005 DB migrates to 0006/0007/0008/0009/0010; historical checksums unchanged; backup created", () => {
  const r = root();
  const conn = new SqliteConnection(join(r, DB_FILENAME));
  const mig5 = mkdtempSync(join(tmpdir(), "fs-mig5-"));
  copyRange(mig5, THRU_0005);
  const res5 = new MigrationRunner(mig5).migrate(conn, join(r, "backups", "db"));
  assert.equal(res5.migratedCount, 5);

  const runner = new MigrationRunner();
  const res = runner.migrate(conn, join(r, "backups", "db"));
  assert.equal(res.migratedCount, 5);
  assert.equal(res.backedUp, true);

  const applied = runner.applied(conn);
  for (const f of THRU_0005) {
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
  copyRange(bad, THRU_0005);
  writeFileSync(join(bad, "0006_broken.sql"), "CREATE TABLE should_not_exist (id TEXT); THIS IS NOT SQL;");
  assert.throws(() => new MigrationRunner(bad).migrate(conn, join(r, "backups", "db")));
  assert.equal(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'"), undefined);
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 5);
  conn.close();
});

test("conversation persistence: store_id retained; messages/ownership do NOT repeat merchant", () => {
  const r = root();
  const { conn } = openDatabase(r);
  seedParents(conn, "m1", "s1", "pa1");
  seedParents(conn, "m1", "s2", "pa1");
  const convs = new SqliteNormalizedConversationRepository(conn);
  const msgs = new SqliteMessageRepository(conn);
  const owns = new SqliteOwnershipRepository(conn);

  const convCols = conn.all<{ name: string }>("PRAGMA table_info(normalized_conversations)").map((c) => c.name);
  assert.ok(convCols.includes("store_id"), "conversation must persist store_id");
  for (const t of ["normalized_messages","ownership_records"]) {
    const names = conn.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name);
    assert.ok(!names.includes("merchant_id"), `${t} must not repeat merchant`);
  }

  convs.save({ id: "nc1", merchantId: "m1", storeId: "s1", platformAccountId: "pa1", externalRef: "ext-c" });
  convs.save({ id: "nc2", merchantId: "m1", storeId: "s2", platformAccountId: "pa1" });
  convs.save({ id: "nc3", merchantId: "m1", storeId: "s1", platformAccountId: "pa1" });
  assert.deepEqual(convs.listByMerchant("m1").map((c) => c.id).sort(), ["nc1", "nc2", "nc3"]);
  assert.deepEqual(convs.listByStore("s1").map((c) => c.id).sort(), ["nc1", "nc3"]);
  assert.equal(convs.findById("nc1")?.externalRef, "ext-c");

  msgs.save({ id: "nm1", conversationId: "nc1", externalRef: "ext-m" });
  assert.deepEqual(msgs.listByConversation("nc1").map((m) => m.id), ["nm1"]);
  assert.equal(msgs.findById("nm1")?.externalRef, "ext-m");

  owns.save({ conversationId: "nc1", state: "CLAIMED", ownerKind: "member", ownerMemberId: "mem1" });
  owns.save({ conversationId: "nc2", state: "AI_ACTIVE", ownerKind: "ai" });
  owns.save({ conversationId: "nc3", state: "UNASSIGNED" });
  assert.deepEqual(owns.findById("nc1"), { conversationId: "nc1", state: "CLAIMED", ownerKind: "member", ownerMemberId: "mem1" });
  assert.deepEqual(owns.findById("nc2"), { conversationId: "nc2", state: "AI_ACTIVE", ownerKind: "ai", ownerMemberId: null });
  assert.deepEqual(owns.findById("nc3"), { conversationId: "nc3", state: "UNASSIGNED", ownerKind: null, ownerMemberId: null });
  assert.equal(owns.findById("nope"), null);

  conn.close();
});

test("ownership: snapshot only — no CHECK on state, no state<->owner combo rules, no authority validation", () => {
  const r = root();
  const { conn } = openDatabase(r);
  seedParents(conn, "m1", "s1", "pa1");
  const convs = new SqliteNormalizedConversationRepository(conn);
  const owns = new SqliteOwnershipRepository(conn);
  convs.save({ id: "c1", merchantId: "m1", storeId: "s1", platformAccountId: "pa1" });
  convs.save({ id: "c2", merchantId: "m1", storeId: "s1", platformAccountId: "pa1" });

  const ddl = conn.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name='ownership_records'").sql;
  assert.ok(!/CHECK\s*\(/i.test(ddl), "no CHECK constraints on ownership_records");
  // structure only: arbitrary state + owner combination persists without validation
  owns.save({ conversationId: "c1", state: "UNASSIGNED", ownerKind: "member", ownerMemberId: "mem-x" });
  owns.save({ conversationId: "c2", state: "ANY_STATE_STRING", ownerKind: null });
  assert.equal(owns.findById("c1")?.state, "UNASSIGNED");
  assert.equal(owns.findById("c2")?.state, "ANY_STATE_STRING");
  conn.close();
});

test("legacy collision negative: new repos only touch normalized_* tables", () => {
  const r = root();
  const { conn } = openDatabase(r);
  // seed LEGACY tables directly (as legacy code would)
  conn.run("INSERT INTO conversations (conversation_id, shop_id, buyer, started_at, updated_at, state) VALUES ('legacy-conv-1', 'shop-1', 'buyer', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'active')");
  conn.run("INSERT INTO conversation_messages (message_id, conversation_id, shop_id, platform, buyer, type, content, role, created_at) VALUES ('legacy-msg-1', 'legacy-conv-1', 'shop-1', 'pdd', 'buyer', 'text', 'hi', 'buyer', '2026-01-01T00:00:00Z')");

  seedParents(conn, "m1", "s1", "pa1");
  const convs = new SqliteNormalizedConversationRepository(conn);
  const msgs = new SqliteMessageRepository(conn);
  const owns = new SqliteOwnershipRepository(conn);

  // new repos do NOT see legacy rows
  assert.equal(convs.findById("legacy-conv-1"), null, "legacy conversation invisible to normalized repo");
  assert.equal(msgs.findById("legacy-msg-1"), null, "legacy message invisible to message repo");
  assert.equal(owns.findById("legacy-conv-1"), null);

  // new repo writes go to normalized_* only; legacy tables untouched
  const legacyConvCountBefore = conn.get("SELECT COUNT(*) AS c FROM conversations").c;
  const legacyMsgCountBefore = conn.get("SELECT COUNT(*) AS c FROM conversation_messages").c;
  convs.save({ id: "nc-new", merchantId: "m1", storeId: "s1", platformAccountId: "pa1" });
  msgs.save({ id: "nm-new", conversationId: "nc-new" });
  owns.save({ conversationId: "nc-new", state: "ACTIVE" });
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM conversations").c, legacyConvCountBefore, "legacy conversations untouched");
  assert.equal(conn.get("SELECT COUNT(*) AS c FROM conversation_messages").c, legacyMsgCountBefore, "legacy messages untouched");
  conn.close();
});

test("repositories expose NO delete operations; no sync fields", () => {
  const r = root();
  const { conn } = openDatabase(r);
  const instances = [
    new SqliteNormalizedConversationRepository(conn), new SqliteMessageRepository(conn), new SqliteOwnershipRepository(conn),
  ];
  for (const inst of instances) {
    for (const name of ["delete","remove","hardDelete","tombstone"]) {
      assert.equal(typeof (inst as Record<string, unknown>)[name], "undefined", `no ${name}`);
    }
  }
  const convCols = conn.all<{ name: string }>("PRAGMA table_info(normalized_conversations)").map((c) => c.name);
  for (const k of ["revision","deleted_at","remote_id","last_synced_at","pending_upload"]) {
    assert.ok(!convCols.includes(k), `no sync field ${k}`);
  }
  conn.close();
});

