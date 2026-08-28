import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteNormalizedConversationRepository, SqliteMessageRepository,
  SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository,
  SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId,
  type NormalizedConversationRepository,
} from "@fastwork/persistence";
import { createWorkerBackedMainContext } from "../dist/main/worker-runtime.js";
import { createMessageIngestion } from "../dist/main/services/message-ingestion.js";

// SHEEP-063-PR1 Message Fact + Runtime Ingestion Foundation guards:
//   - fresh 0001->0009: schema v9 + typed message fact columns; external_ref stays
//     OPAQUE (no invented UNIQUE, I-13); actor/content_kind CHECKs present.
//   - v7->v9 upgrade: legacy fact-less normalized_messages rows keep NULL facts
//     (I-16 — migration never fabricates historical message facts).
//   - DP-83/86/87/88 + I-15: typed text-first content; conversation actor != LLM role;
//     occurred_at (source, may be unknown) distinct from observed_at (Fast Sheep,
//     produced at the Main ingestion boundary).
//   - DP-90: SqliteMessageRepository shares the production Main DB lifecycle
//     (createWorkerBackedMainContext, m10Sqlite.conn) — cross-connection proof.
//   - DP-66: production composition fails closed on corrupt DB (no memory fallback).
//   - close/reopen round-trip through the real ingestion boundary.
//   - I-12: deterministic explainable ordering; equal-time tie; local ingestion
//     order never masquerades as source/platform absolute order.
//   - conversation isolation: listByConversation(c1) never returns c2 messages.
function tempRoot() {
  return mkdtempSync(join(tmpdir(), "fs-msgpr1-"));
}
function seedIdentity(conn: SqliteConnection, stores: Array<{ id: string; merchantId: string; platform: string }>) {
  const merchants = new Set(stores.map((s) => s.merchantId));
  const mRepo = new SqliteMerchantRepository(conn);
  const sRepo = new SqliteStoreRepository(conn);
  const paRepo = new SqlitePlatformAccountRepository(conn);
  for (const m of merchants) mRepo.save({ id: m, name: "merchant-" + m });
  for (const s of stores) {
    sRepo.save({ id: s.id, merchantId: s.merchantId, name: "store-" + s.id, platform: s.platform });
    paRepo.save({ id: "pa-" + s.id, merchantId: s.merchantId, platform: s.platform });
  }
}
function saveConversation(conn: SqliteConnection, id: string, merchantId: string, storeId: string): void {
  new SqliteNormalizedConversationRepository(conn).save({ id, merchantId, storeId, platformAccountId: "pa-" + storeId });
}
function withTemp(fn: (root: string) => void) {
  const root = tempRoot();
  try {
    fn(root);
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort cleanup (Windows may hold open DB conns) */ }
  }
}

const THRU_0007 = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql","0005_identity_domain.sql","0006_conversation_domain.sql","0007_commerce_domain.sql"];

test("fresh 0001->0009: schema v9, typed message fact columns; external_ref opaque (no UNIQUE); CHECKs present", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    assert.equal(ctx.schemaVersion, 9, "fresh DB must be schema v9");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 9, "0001-0009 applied");

    const cols = ctx.conn.all<{ name: string }>("PRAGMA table_info(normalized_messages)").map((c) => c.name);
    for (const col of ["id","conversation_id","external_ref","actor","content_kind","content_text","occurred_at","observed_at"]) {
      assert.ok(cols.includes(col), `column ${col} present`);
    }

    const ddl = ctx.conn.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name='normalized_messages'").sql;
    assert.ok(/CHECK\s*\(\s*actor\s+IN\s*\(\s*'customer'\s*,\s*'agent'\s*\)/i.test(ddl), "actor CHECK (customer|agent) present");
    assert.ok(/CHECK\s*\(\s*content_kind\s+IN\s*\(\s*'text'\s*\)/i.test(ddl), "content_kind CHECK (text-only) present");
    assert.ok(!/UNIQUE\s*\(\s*external_ref/i.test(ddl), "no invented UNIQUE on external_ref (I-13)");
    ctx.conn.close();
  });
});

test("v7->v9 upgrade (0008+0009): legacy fact-less normalized_messages rows keep NULL facts (I-16); checksums unchanged", () => {
  withTemp((root) => {
    const dbPath = join(root, DB_FILENAME);
    const mig7 = mkdtempSync(join(tmpdir(), "fs-msgv7-"));
    for (const f of THRU_0007) copyFileSync(join(MIGRATIONS_DIR, f), join(mig7, f));

    const conn = new SqliteConnection(dbPath);
    const res7 = new MigrationRunner(mig7).migrate(conn, join(root, "backups", "db"));
    assert.equal(res7.migratedCount, 7, "0001-0007 applied to v7");
    assert.equal(conn.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "7");

    // legacy-shaped fact-less rows (only id/conversation_id/external_ref existed at v7)
    conn.run("INSERT INTO merchants (id, name) VALUES ('m1','m')");
    conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES ('s1','m1','s','pdd')");
    conn.run("INSERT INTO platform_accounts (id, merchant_id, platform) VALUES ('pa1','m1','pdd')");
    conn.run("INSERT INTO normalized_conversations (id, merchant_id, store_id, platform_account_id, external_ref) VALUES ('c1','m1','s1','pa1','ext-c')");
    conn.run("INSERT INTO normalized_messages (id, conversation_id, external_ref) VALUES ('m1','c1','ext-m')");

    const runner = new MigrationRunner();
    const res = runner.migrate(conn, join(root, "backups", "db"));
    assert.equal(res.migratedCount, 2, "0008+0009 applied (v7 -> v9)");
    assert.equal(res.backedUp, true, "backup created before upgrade");
    assert.equal(conn.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "9");

    // I-16: unknown historical facts remain unknown — no system/empty/migration-time backfill
    const row = conn.get<{ actor: string | null; content_kind: string | null; content_text: string | null; occurred_at: string | null; observed_at: string | null }>(
      "SELECT actor, content_kind, content_text, occurred_at, observed_at FROM normalized_messages WHERE id='m1'"
    );
    assert.equal(row.actor, null);
    assert.equal(row.content_kind, null);
    assert.equal(row.content_text, null);
    assert.equal(row.occurred_at, null);
    assert.equal(row.observed_at, null);

    // historical checksums 0001-0007 unchanged
    for (const f of THRU_0007) {
      const v = Number(f.match(/^(\d+)_/)?.[1]);
      const applied = runner.applied(conn).find((a) => a.version === v);
      assert.ok(applied, `record for ${f}`);
      const expected = createHash("sha256").update(readFileSync(join(MIGRATIONS_DIR, f), "utf-8")).digest("hex");
      assert.equal(applied.checksum, expected, `checksum unchanged: ${f}`);
    }
    conn.close();
  });
});

test("ingestion boundary: typed text-first (DP-88), actor customer|agent (DP-86/I-15), observed_at produced at boundary (DP-87), repository never fabricates", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    seedIdentity(ctx.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }]);
    saveConversation(ctx.conn, "c1", "m-A", "A1");
    const repo = new SqliteMessageRepository(ctx.conn);
    const ingestion = createMessageIngestion(repo);

    const occurredAt = "2026-08-01T00:00:00Z";
    ingestion.saveNormalizedMessage({
      id: "m1", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "你好", occurredAt,
    });
    const saved = repo.findById("m1");
    assert.ok(saved, "message persisted");
    assert.equal(saved?.actor, "customer");
    assert.equal(saved?.contentKind, "text");
    assert.equal(saved?.contentText, "你好");
    assert.equal(saved?.occurredAt, occurredAt, "occurred_at (source time) preserved as provided");
    assert.ok(saved?.observedAt && /^\d{4}-\d{2}-\d{2}T/.test(saved.observedAt), "observed_at produced at ingestion boundary (DP-87)");
    assert.notEqual(saved?.observedAt, occurredAt, "observed_at must not masquerade as occurred_at");

    // boundary rejects missing actor (no fabricated actor)
    assert.throws(
      () => ingestion.saveNormalizedMessage({ id: "bad1", conversationId: "c1", contentKind: "text", contentText: "x" }),
      /actor/i,
      "ingestion requires a conversation actor"
    );
    // boundary rejects non-text content (DP-88 typed text-first)
    assert.throws(
      () => ingestion.saveNormalizedMessage({ id: "bad2", conversationId: "c1", actor: "agent", contentKind: "image" as never, contentText: null as never }),
      /text content/i,
      "ingestion requires typed text content"
    );

    // repository directly persists unknown fact-less rows (I-16); no fabrication
    repo.save({ id: "legacy-unknown", conversationId: "c1" });
    const unknown = repo.findById("legacy-unknown");
    assert.equal(unknown?.actor, null);
    assert.equal(unknown?.contentKind, null);
    assert.equal(unknown?.contentText, null);
    assert.equal(unknown?.occurredAt, null);
    assert.equal(unknown?.observedAt, null);
    ctx.conn.close();
  });
});

test("DP-90 production composition binds SQLite (shared connection; cross-connection proof; no memory fallback)", () => {
  withTemp((root) => {
    const seedCtx = openDatabase(root);
    // SHEEP-063-PR2-PR1: establish the trusted workspace merchant identity FIRST
    // (I-20/I-21: a merchants row without a pointer is ambiguous and fails closed),
    // then seed the message-fixture parent identity rows (FK sources).
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(seedCtx.conn));
    assert.ok(/^merchant-/.test(wsId), "workspace merchant identity bootstrapped");
    seedIdentity(seedCtx.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }]);
    seedCtx.conn.close();

    const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;
    const ctx = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.equal(ctx.workspaceMerchant?.merchantId, wsId, "composition resolves the same workspace merchant id");
    const convs: NormalizedConversationRepository = ctx.conversations;
    convs.save({ id: "pc1", merchantId: "m-A", storeId: "A1", platformAccountId: "pa-A1" });
    const ingestion = createMessageIngestion(ctx.messages);
    ingestion.saveNormalizedMessage({ id: "pm1", conversationId: "pc1", actor: "agent", contentKind: "text", contentText: "您好" });

    // Independent fresh connection on the SAME data root proves the production
    // message source is SQLite-backed (an in-memory double would not appear here).
    const probe = openDatabase(root);
    const probeRepo = new SqliteMessageRepository(probe.conn);
    const found = probeRepo.findById("pm1");
    assert.ok(found, "production message source is SQLite (cross-connection proof)");
    assert.equal(found?.contentText, "您好");
    assert.equal(found?.actor, "agent");
    probe.conn.close();
  });
});

test("close/reopen round-trip through real ingestion boundary (durability)", () => {
  withTemp((root) => {
    const ctx1 = openDatabase(root);
    seedIdentity(ctx1.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }]);
    saveConversation(ctx1.conn, "c1", "m-A", "A1");
    const ingestion = createMessageIngestion(new SqliteMessageRepository(ctx1.conn));
    ingestion.saveNormalizedMessage({ id: "r1", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "persist me", occurredAt: "2026-08-02T00:00:00Z" });
    ctx1.conn.close();

    const ctx2 = openDatabase(root);
    const repo2 = new SqliteMessageRepository(ctx2.conn);
    const list = repo2.listByConversation("c1");
    assert.equal(list.length, 1);
    assert.equal(list[0].id, "r1");
    assert.equal(list[0].contentText, "persist me");
    assert.equal(list[0].occurredAt, "2026-08-02T00:00:00Z");
    assert.ok(list[0].observedAt, "observed_at durable after reopen");
    ctx2.conn.close();
  });
});

test("I-12 deterministic ordering + equal-time tie; local ingestion order never masquerades as source order", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    seedIdentity(ctx.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }]);
    saveConversation(ctx.conn, "c1", "m-A", "A1");
    const repo = new SqliteMessageRepository(ctx.conn);
    const ingestion = createMessageIngestion(repo);

    // Insert in a deliberately non-source order to prove ordering is fact-driven.
    ingestion.saveNormalizedMessage({ id: "m-a", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "a", occurredAt: "2026-08-02T00:00:00Z" });
    ingestion.saveNormalizedMessage({ id: "m-d", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "d-unknown" });
    ingestion.saveNormalizedMessage({ id: "m-b", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "b", occurredAt: "2026-08-01T00:00:00Z" });
    ingestion.saveNormalizedMessage({ id: "m-e", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "e-unknown" });
    ingestion.saveNormalizedMessage({ id: "m-c", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "c", occurredAt: "2026-08-01T00:00:00Z" });

    const ids = repo.listByConversation("c1").map((m) => m.id);
    // occurred_at known ascending first; equal time (b,c) tie by id; unknown last by id.
    assert.deepEqual(ids, ["m-b", "m-c", "m-a", "m-d", "m-e"], "deterministic explainable ordering (I-12)");
    ctx.conn.close();
  });
});

test("conversation isolation: listByConversation(c1) never returns c2 messages", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    seedIdentity(ctx.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }]);
    saveConversation(ctx.conn, "c1", "m-A", "A1");
    saveConversation(ctx.conn, "c2", "m-A", "A1");
    const repo = new SqliteMessageRepository(ctx.conn);
    repo.save({ id: "x1", conversationId: "c1", actor: "customer", contentKind: "text", contentText: "c1-msg" });
    repo.save({ id: "x2", conversationId: "c2", actor: "agent", contentKind: "text", contentText: "c2-msg" });
    assert.deepEqual(repo.listByConversation("c1").map((m) => m.id), ["x1"]);
    assert.deepEqual(repo.listByConversation("c2").map((m) => m.id), ["x2"]);
    ctx.conn.close();
  });
});

test("DP-66 fail-closed: corrupt DB — production composition (message repo included) fails closed, no memory fallback", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    const dbPath = ctx.dataRoot.databasePath;
    ctx.conn.close();
    writeFileSync(dbPath, "this is not a sqlite database", "utf-8");
    const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;
    assert.throws(
      () => createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root }),
      /integrity|corrupt|sqlite|not a database|database/i,
      "production composition must fail closed (no silent in-memory fallback)"
    );
  });
});


