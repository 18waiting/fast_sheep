// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-066-PR1: durable Text Delivery Attempt journal guards (state machine, typed
// outcome, durable recovery, atomic ACK finalization, I-34/I-37/I-38/I-39/I-40/I-41).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId,
  SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository,
  SqliteNormalizedConversationRepository, SqliteMessageRepository,
  SqliteDeliveryAttemptRepository,
  createAuthorizedDeliveryAttempt, runDeliveryAttempt, finalizeAcknowledgedDelivery,
  recoverInFlightAttempts, recoverWorkspaceInFlightDeliveryAttempts, generateDeliveryAttemptId, generateDeliveryMessageId,
  DeliveryAttemptError,
  type DeliveryAttemptRecord, type TextDeliveryPort, type DeliveryAttemptAuthorizerPort,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-dla-")); }
async function withTemp(fn: (r: string) => void | Promise<void>) {
  const r = root();
  try { await fn(r); } finally { try { rmSync(r, { recursive: true, force: true }); } catch { /* best-effort */ } }
}
function sha256(path: string): string { return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex"); }
const THRU_0009 = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql","0005_identity_domain.sql","0006_conversation_domain.sql","0007_commerce_domain.sql","0008_message_facts.sql","0009_relax_merchant_name.sql"];

function seedConv(conn: SqliteConnection): { conversationId: string; storeId: string; platformAccountId: string; wsId: string } {
  const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(conn));
  const m = new SqliteMerchantRepository(conn);
  const s = new SqliteStoreRepository(conn);
  const pa = new SqlitePlatformAccountRepository(conn);
  const convs = new SqliteNormalizedConversationRepository(conn);
  // idempotent seeding (multiple makeAttempt calls share one DB)
  if (!m.findById(wsId)) m.save({ id: wsId, name: null });
  if (!s.findById("A1")) s.save({ id: "A1", merchantId: wsId, name: "A1", platform: "pdd" });
  if (!pa.findById("pa-A1")) pa.save({ id: "pa-A1", merchantId: wsId, platform: "pdd" });
  if (!convs.findById("conv-1")) convs.save({ id: "conv-1", merchantId: wsId, storeId: "A1", platformAccountId: "pa-A1", externalRef: null });
  return { conversationId: "conv-1", storeId: "A1", platformAccountId: "pa-A1", wsId };
}

/** SHEEP-074-PR1: seed a merchant-scoped store/platform-account/conversation triple. */
function seedConvFor(conn: SqliteConnection, merchantId: string, storeId: string, paId: string, convId: string): void {
  const m = new SqliteMerchantRepository(conn);
  const s = new SqliteStoreRepository(conn);
  const pa = new SqlitePlatformAccountRepository(conn);
  const convs = new SqliteNormalizedConversationRepository(conn);
  if (!m.findById(merchantId)) m.save({ id: merchantId, name: null });
  if (!s.findById(storeId)) s.save({ id: storeId, merchantId, name: storeId, platform: "pdd" });
  if (!pa.findById(paId)) pa.save({ id: paId, merchantId, platform: "pdd" });
  if (!convs.findById(convId)) convs.save({ id: convId, merchantId, storeId, platformAccountId: paId, externalRef: null });
}

function allowAll(): DeliveryAttemptAuthorizerPort {
  return { authorize: () => "ALLOWED" as const };
}
function denyAll(): DeliveryAttemptAuthorizerPort {
  return { authorize: () => "DENIED" as const };
}
function unavailable(): DeliveryAttemptAuthorizerPort {
  return { authorize: () => "UNAVAILABLE" as const };
}
function makeAttempt(conn: SqliteConnection, text = "要发送的回复文本"): DeliveryAttemptRecord {
  const seed = seedConv(conn);
  return createAuthorizedDeliveryAttempt(conn, { id: generateDeliveryAttemptId(), conversationId: seed.conversationId, textPayload: text, createdAt: "2026-08-29T00:00:00Z" }, allowAll());
}

test("fresh 0001->0010: schema v10, delivery_attempts table + FK + CHECK", () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    assert.equal(ctx.schemaVersion, 10);
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 10);
    const cols = ctx.conn.all<{ name: string }>("PRAGMA table_info(delivery_attempts)").map((x) => x.name);
    for (const col of ["id","conversation_id","store_id","platform_account_id","text_payload","status","created_at","dispatched_at","resolved_at","delivered_message_id","ack_source_ref","ack_occurred_at"]) {
      assert.ok(cols.includes(col), "column " + col);
    }
    const ddl = ctx.conn.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name='delivery_attempts'").sql;
    assert.ok(/CHECK\s*\(\s*status\s+IN\s*\(\s*'PENDING'\s*,\s*'IN_FLIGHT'\s*,\s*'ACKNOWLEDGED'\s*,\s*'REJECTED'\s*,\s*'UNKNOWN'\s*\)/i.test(ddl), "status CHECK present");
    assert.ok(!/reconciliation_note/i.test(ddl), "no free-text reconciliation_note (tightening #9)");
    // FK integrity
    assert.throws(() => ctx.conn.run("INSERT INTO delivery_attempts (id, conversation_id, store_id, platform_account_id, text_payload, status, created_at) VALUES ('x','nope','A1','pa-A1','t','PENDING','2026-08-29T00:00:00Z')"), /FOREIGN KEY/i);
    ctx.conn.close();
  });
});

test("v9->v10 upgrade: delivery_attempts created; checksums 0001-0009 unchanged", () => {
  withTemp(async (r) => {
    const dbPath = join(r, DB_FILENAME);
    const mig9 = mkdtempSync(join(tmpdir(), "fs-dla9-"));
    for (const f of THRU_0009) copyFileSync(join(MIGRATIONS_DIR, f), join(mig9, f));
    const conn = new SqliteConnection(dbPath);
    const res9 = new MigrationRunner(mig9).migrate(conn, join(r, "backups", "db"));
    assert.equal(res9.migratedCount, 9);
    const runner = new MigrationRunner();
    const res = runner.migrate(conn, join(r, "backups", "db"));
    assert.equal(res.migratedCount, 1, "0010 applied (v9 -> v10)");
    assert.equal(res.backedUp, true);
    assert.equal(conn.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "10");
    assert.ok(conn.get("SELECT name FROM sqlite_master WHERE type='table' AND name='delivery_attempts'"), "delivery_attempts exists");
    for (const f of THRU_0009) {
      const v = Number(f.match(/^(\d+)_/)?.[1]);
      const applied = runner.applied(conn).find((a) => a.version === v);
      assert.ok(applied, "record for " + f);
      assert.equal(applied.checksum, sha256(join(MIGRATIONS_DIR, f)), "checksum unchanged: " + f);
    }
    conn.close();
  });
});

test("authorization-before-attempt: DENIED/UNAVAILABLE -> no attempt created (DP-120)", () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const seed = seedConv(ctx.conn);
    for (const auth of [denyAll(), unavailable()]) {
      assert.throws(() => createAuthorizedDeliveryAttempt(ctx.conn, { id: generateDeliveryAttemptId(), conversationId: seed.conversationId, textPayload: "x", createdAt: "2026-08-29T00:00:00Z" }, auth), DeliveryAttemptError);
    }
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM delivery_attempts").c, 0, "no attempt created when not ALLOWED");
    ctx.conn.close();
  });
});

test("create PENDING attempt captures target identity from the authorized conversation (I-37) + immutable payload", () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const a = makeAttempt(ctx.conn, "原文快照");
    assert.equal(a.status, "PENDING");
    assert.equal(a.conversationId, "conv-1");
    assert.equal(a.storeId, "A1", "target identity captured at creation (I-37)");
    assert.equal(a.platformAccountId, "pa-A1");
    assert.equal(a.textPayload, "原文快照");
    // repository create rejects non-PENDING
    assert.throws(() => new SqliteDeliveryAttemptRepository(ctx.conn).create({ ...a, status: "IN_FLIGHT" }), DeliveryAttemptError);
    ctx.conn.close();
  });
});

test("I-39: IN_FLIGHT is durable BEFORE the external delivery side effect", async () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const a = makeAttempt(ctx.conn, "deliver me");
    const repo = new SqliteDeliveryAttemptRepository(ctx.conn);
    let seenStatus = "";
    const port: TextDeliveryPort = {
      async deliver(attempt) {
        seenStatus = new SqliteDeliveryAttemptRepository(ctx.conn).findById(attempt.id)?.status ?? "MISSING";
        return { outcome: "UNKNOWN" };
      },
    };
    await runDeliveryAttempt(ctx.conn, a, port);
    // deliver ran synchronously before the await resolves; IN_FLIGHT must be durable in DB
    assert.equal(seenStatus, "IN_FLIGHT", "IN_FLIGHT persisted before port.deliver side effect (I-39)");
    ctx.conn.close();
  });
});

test("runDeliveryAttempt: ACK -> atomic delivered message fact + ACK (DP-130/I-35/I-40); occurred_at from typed source time", async () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const a = makeAttempt(ctx.conn, "已确认发送的文本");
    const port: TextDeliveryPort = { async deliver() { return { outcome: "ACKNOWLEDGED", sourceRef: "src-abc", occurredAt: "2026-08-29T01:00:00Z" }; } };
    const { attempt } = await runDeliveryAttempt(ctx.conn, a, port);
    assert.equal(attempt.status, "ACKNOWLEDGED");
    assert.equal(attempt.deliveredMessageId, generateDeliveryMessageId(a.id), "typed link (I-40)");
    assert.equal(attempt.ackSourceRef, "src-abc");
    assert.equal(attempt.ackOccurredAt, "2026-08-29T01:00:00Z");
    // delivered message fact exists (actor=agent/text; occurred_at = typed source time)
    const msg = new SqliteMessageRepository(ctx.conn).findById(attempt.deliveredMessageId as string);
    assert.ok(msg);
    assert.equal(msg?.actor, "agent");
    assert.equal(msg?.contentText, "已确认发送的文本");
    assert.equal(msg?.occurredAt, "2026-08-29T01:00:00Z");
    assert.ok(msg?.observedAt, "observed_at produced at delivery finalization boundary");
    // I-40 idempotent: repeat finalize is a no-op (no duplicate message)
    const before = ctx.conn.get("SELECT COUNT(*) AS c FROM normalized_messages").c;
    const again = finalizeAcknowledgedDelivery(ctx.conn, { attemptId: a.id, message: { id: "x", conversationId: "conv-1" } as never, resolvedAt: "2026-08-29T02:00:00Z", sourceRef: null, occurredAt: null });
    assert.equal(again.status, "ACKNOWLEDGED");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM normalized_messages").c, before, "no duplicate Timeline message (I-40)");
    ctx.conn.close();
  });
});

test("runDeliveryAttempt: REJECTED / UNKNOWN terminal; no delivered fact; terminal immutable (I-38/I-33/I-35)", async () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const a1 = makeAttempt(ctx.conn, "rejected text");
    const a2 = makeAttempt(ctx.conn, "unknown text");
    await runDeliveryAttempt(ctx.conn, a1, { async deliver() { return { outcome: "REJECTED" }; } });
    await runDeliveryAttempt(ctx.conn, a2, { async deliver() { return { outcome: "UNKNOWN" }; } });
    const repo = new SqliteDeliveryAttemptRepository(ctx.conn);
    assert.equal(repo.findById(a1.id)?.status, "REJECTED");
    assert.equal(repo.findById(a2.id)?.status, "UNKNOWN");
    assert.equal(repo.findById(a1.id)?.deliveredMessageId, null, "REJECTED never creates delivered fact (I-35)");
    assert.equal(repo.findById(a2.id)?.deliveredMessageId, null, "UNKNOWN never creates delivered fact (I-33/I-35)");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM normalized_messages").c, 0, "no delivered fact");
    // terminal immutable: resolving again is a no-op (I-38)
    repo.resolve(a1.id, "UNKNOWN", "2026-08-29T03:00:00Z");
    assert.equal(repo.findById(a1.id)?.status, "REJECTED", "terminal states immutable (I-38)");
    // retry creates a NEW attempt, never overwrites history (I-38)
    const retry = makeAttempt(ctx.conn, "retry text");
    assert.notEqual(retry.id, a1.id);
    ctx.conn.close();
  });
});

test("DP-128: unresolved IN_FLIGHT recovers as UNKNOWN (not FAILED); no auto-retry (I-33)", async () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const a = makeAttempt(ctx.conn, "crash text");
    new SqliteDeliveryAttemptRepository(ctx.conn).markInFlight(a.id, "2026-08-29T00:00:05Z");
    const recovered = recoverInFlightAttempts(ctx.conn, "2026-08-29T01:00:00Z");
    assert.equal(recovered, 1);
    const after = new SqliteDeliveryAttemptRepository(ctx.conn).findById(a.id);
    assert.equal(after?.status, "UNKNOWN", "recovery = UNKNOWN not FAILED (DP-128)");
    assert.equal(after?.resolvedAt, "2026-08-29T01:00:00Z");
    assert.equal(after?.deliveredMessageId, null, "no delivered fact");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM normalized_messages").c, 0);
    ctx.conn.close();
  });
});

test("I-41: attempt text payload is never emitted into error strings", async () => {
  withTemp(async (r) => {
    const ctx = openDatabase(r);
    const secretText = "SECRET-REPLY-TEXT-勿外泄";
    const a = makeAttempt(ctx.conn, secretText);
    // a refused finalize on a terminal REJECTED attempt must not leak the payload
    const b = makeAttempt(ctx.conn, secretText);
    await runDeliveryAttempt(ctx.conn, b, { async deliver() { return { outcome: "REJECTED" }; } });
    try {
      finalizeAcknowledgedDelivery(ctx.conn, { attemptId: b.id, message: { id: "m2", conversationId: "conv-1" } as never, resolvedAt: "2026-08-29T00:00:02Z", sourceRef: null, occurredAt: null });
      assert.fail("should throw on REJECTED finalize");
    } catch (e) {
      assert.ok(!String((e as Error).message).includes(secretText), "error must not contain payload (I-41)");
    }
    ctx.conn.close();
  });
});
// ---- SHEEP-074-PR1: merchant-scoped startup recovery (DP-178/I-115..I-119) ----

test("SHEEP-074-PR1: recoverWorkspaceInFlightDeliveryAttempts is merchant-scoped, idempotent, UNKNOWN-only", () => {
  withTemp(async (r) => {
    const { conn } = openDatabase(r);
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(conn));
    seedConvFor(conn, wsId, "A1", "pa-A1", "conv-A1");
    seedConvFor(conn, "mB", "B1", "pa-B1", "conv-B1");
    const repo = new SqliteDeliveryAttemptRepository(conn);
    const a = createAuthorizedDeliveryAttempt(conn, { id: generateDeliveryAttemptId(), conversationId: "conv-A1", textPayload: "A", createdAt: "2026-08-29T00:00:00Z" }, allowAll());
    const b = createAuthorizedDeliveryAttempt(conn, { id: generateDeliveryAttemptId(), conversationId: "conv-B1", textPayload: "B", createdAt: "2026-08-29T00:00:00Z" }, allowAll());
    repo.markInFlight(a.id, "2026-08-29T00:00:05Z");
    repo.markInFlight(b.id, "2026-08-29T00:00:05Z");

    const res = recoverWorkspaceInFlightDeliveryAttempts(conn, wsId, "2026-08-29T02:00:00Z");
    assert.equal(res.recovered, 1, "only workspace merchant attempt recovered");
    assert.equal(res.untouchedOtherOrUnknownOwner, 1, "other merchant attempt untouched (I-119)");
    assert.equal(repo.findById(a.id)?.status, "UNKNOWN", "IN_FLIGHT -> UNKNOWN (DP-128, not REJECTED/ACK)");
    assert.equal(repo.findById(a.id)?.deliveredMessageId, null, "no delivered message fact on recovery");
    assert.equal(repo.findById(b.id)?.status, "IN_FLIGHT", "other merchant untouched");

    // I-116: second recovery run is a no-op (nothing IN_FLIGHT for this merchant remains)
    const again = recoverWorkspaceInFlightDeliveryAttempts(conn, wsId, "2026-08-29T03:00:00Z");
    assert.equal(again.recovered, 0);
    assert.equal(repo.findById(a.id)?.resolvedAt, "2026-08-29T02:00:00Z", "resolvedAt not rewritten");
    conn.close();
  });
});
