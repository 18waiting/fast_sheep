import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openDatabase, SqliteDeliveryAttemptRepository, SqliteMerchantRepository, SqliteStoreRepository,
  SqlitePlatformAccountRepository, SqliteNormalizedConversationRepository, SqliteMessageRepository,
  SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId,
  createAuthorizedDeliveryAttempt, runDeliveryAttempt, recoverInFlightAttempts, recoverWorkspaceInFlightDeliveryAttempts, generateDeliveryAttemptId,
  type DeliveryAttemptRecord, type TextDeliveryPort, type DeliveryAttemptAuthorizerPort,
} from "@fastwork/persistence";
import { createWorkerBackedMainContext } from "../dist/main/worker-runtime.js";

// SHEEP-066-PR1 composition guards:
//   - production composition binds SqliteDeliveryAttemptRepository on the shared
//     m10Sqlite.conn (no second DB lifecycle; #14)
//   - production does NOT bind any fake delivery adapter (#14/#15; DP-129 Send disabled)
//   - coordinator state machine via real DB + controlled test adapters (ACK/REJECT/UNKNOWN)
//   - I-41: attempt payload never emitted into errors/logs
function tempRoot() { return mkdtempSync(join(tmpdir(), "fs-dla-desk-")); }
async function withTemp(fn: (r: string) => void | Promise<void>) {
  const r = tempRoot();
  try { await fn(r); } finally { try { rmSync(r, { recursive: true, force: true }); } catch { /* best-effort */ } }
}
const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;

function seedOn(conn: import("@fastwork/persistence").SqliteConnection): { conversationId: string } {
  const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(conn));
  const m = new SqliteMerchantRepository(conn);
  const s = new SqliteStoreRepository(conn);
  const pa = new SqlitePlatformAccountRepository(conn);
  const convs = new SqliteNormalizedConversationRepository(conn);
  if (!m.findById(wsId)) m.save({ id: wsId, name: null });
  if (!s.findById("A1")) s.save({ id: "A1", merchantId: wsId, name: "A1", platform: "pdd" });
  if (!pa.findById("pa-A1")) pa.save({ id: "pa-A1", merchantId: wsId, platform: "pdd" });
  if (!convs.findById("conv-1")) convs.save({ id: "conv-1", merchantId: wsId, storeId: "A1", platformAccountId: "pa-A1", externalRef: null });
  return { conversationId: "conv-1" };
}
/** SHEEP-074-PR1: seed a merchant-scoped store/platform-account/conversation triple. */
function seedConvFor(
  conn: import("@fastwork/persistence").SqliteConnection,
  merchantId: string, storeId: string, paId: string, convId: string,
): void {
  const m = new SqliteMerchantRepository(conn);
  const s = new SqliteStoreRepository(conn);
  const pa = new SqlitePlatformAccountRepository(conn);
  const convs = new SqliteNormalizedConversationRepository(conn);
  if (!m.findById(merchantId)) m.save({ id: merchantId, name: null });
  if (!s.findById(storeId)) s.save({ id: storeId, merchantId, name: storeId, platform: "pdd" });
  if (!pa.findById(paId)) pa.save({ id: paId, merchantId, platform: "pdd" });
  if (!convs.findById(convId)) convs.save({ id: convId, merchantId, storeId, platformAccountId: paId, externalRef: null });
}

/** SHEEP-074-PR1: create a durable PENDING attempt and drive it to IN_FLIGHT (legal fixture; no fake delivery adapter). */
function seedAttemptOn(conn: import("@fastwork/persistence").SqliteConnection, conversationId: string, storeId: string, paId: string, textPayload: string): string {
  const id = generateDeliveryAttemptId();
  const repo = new SqliteDeliveryAttemptRepository(conn);
  repo.create({ id, conversationId, storeId, platformAccountId: paId, textPayload, status: "PENDING", createdAt: "2026-08-29T00:00:00Z", dispatchedAt: null, resolvedAt: null, deliveredMessageId: null, ackSourceRef: null, ackOccurredAt: null });
  repo.markInFlight(id, "2026-08-29T00:00:05Z");
  return id;
}

const allowAll: DeliveryAttemptAuthorizerPort = { authorize: () => "ALLOWED" };

test("production composition binds SqliteDeliveryAttemptRepository on the shared DB (cross-connection proof) and wires NO delivery adapter", () => {
  withTemp(async (root) => {
    // seed the FK parent conversation BEFORE the production composition opens the shared DB
    const seedCtx = openDatabase(root);
    seedOn(seedCtx.conn);
    seedCtx.conn.close();
    const ctx = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.ok(ctx.deliveryAttempts, "deliveryAttempts repository exposed");
    assert.ok(ctx.deliveryAttempts instanceof SqliteDeliveryAttemptRepository, "production binds Sqlite repo");
    // create an attempt through the production repository -> visible on an independent probe connection
    const probe = openDatabase(root);
    const probeRepo = new SqliteDeliveryAttemptRepository(probe.conn);
    const id = generateDeliveryAttemptId();
    ctx.deliveryAttempts.create({ id, conversationId: "conv-1", storeId: "A1", platformAccountId: "pa-A1", textPayload: "probe text", status: "PENDING", createdAt: "2026-08-29T00:00:00Z", dispatchedAt: null, resolvedAt: null, deliveredMessageId: null, ackSourceRef: null, ackOccurredAt: null });
    assert.ok(probeRepo.findById(id), "production deliveryAttempts source is SQLite (shared connection)");
    // no delivery port is wired on the context (DP-129: Send stays disabled)
    assert.ok(!("deliveryPort" in ctx), "no delivery adapter bound in production composition");
    probe.conn.close();
  });
});

test("coordinator state machine via real DB + controlled test adapters (ACK/REJECT/UNKNOWN; DP-128 recovery)", async () => {
  withTemp(async (root) => {
    const probe = openDatabase(root);
    const { conversationId } = seedOn(probe.conn);
    const ack = createAuthorizedDeliveryAttempt(probe.conn, { id: generateDeliveryAttemptId(), conversationId, textPayload: "ack 文本", createdAt: "2026-08-29T00:00:00Z" }, allowAll);
    const rej = createAuthorizedDeliveryAttempt(probe.conn, { id: generateDeliveryAttemptId(), conversationId, textPayload: "rej 文本", createdAt: "2026-08-29T00:00:00Z" }, allowAll);
    const unk = createAuthorizedDeliveryAttempt(probe.conn, { id: generateDeliveryAttemptId(), conversationId, textPayload: "unk 文本", createdAt: "2026-08-29T00:00:00Z" }, allowAll);
    const ackPort: TextDeliveryPort = { async deliver() { return { outcome: "ACKNOWLEDGED", sourceRef: "src", occurredAt: "2026-08-29T01:00:00Z" }; } };
    const rejPort: TextDeliveryPort = { async deliver() { return { outcome: "REJECTED" }; } };
    const unkPort: TextDeliveryPort = { async deliver() { return { outcome: "UNKNOWN" }; } };
    await runDeliveryAttempt(probe.conn, ack, ackPort);
    await runDeliveryAttempt(probe.conn, rej, rejPort);
    await runDeliveryAttempt(probe.conn, unk, unkPort);
    const repo = new SqliteDeliveryAttemptRepository(probe.conn);
    assert.equal(repo.findById(ack.id)?.status, "ACKNOWLEDGED");
    assert.equal(repo.findById(rej.id)?.status, "REJECTED");
    assert.equal(repo.findById(unk.id)?.status, "UNKNOWN");
    assert.equal(new SqliteMessageRepository(probe.conn).findById(repo.findById(ack.id)?.deliveredMessageId as string)?.contentText, "ack 文本", "ACK -> delivered message fact");
    assert.equal(new SqliteMessageRepository(probe.conn).findById(repo.findById(rej.id)?.deliveredMessageId as string), null, "REJECTED -> no delivered fact");
    // recovery: force an IN_FLIGHT then recover -> UNKNOWN (DP-128)
    const crash = createAuthorizedDeliveryAttempt(probe.conn, { id: generateDeliveryAttemptId(), conversationId, textPayload: "crash 文本", createdAt: "2026-08-29T00:00:00Z" }, allowAll);
    repo.markInFlight(crash.id, "2026-08-29T00:00:05Z");
    const recovered = recoverInFlightAttempts(probe.conn, "2026-08-29T02:00:00Z");
    assert.equal(recovered, 1);
    assert.equal(repo.findById(crash.id)?.status, "UNKNOWN", "recovery = UNKNOWN not FAILED");
    probe.conn.close();
  });
});

test("I-41: attempt payload is never emitted into delivery error strings", async () => {
  withTemp(async (root) => {
    const probe = openDatabase(root);
    const { conversationId } = seedOn(probe.conn);
    const secretText = "ATTEMPT-SECRET-勿外泄";
    const attempt = createAuthorizedDeliveryAttempt(probe.conn, { id: generateDeliveryAttemptId(), conversationId, textPayload: secretText, createdAt: "2026-08-29T00:00:00Z" }, allowAll);
    const repo = new SqliteDeliveryAttemptRepository(probe.conn);
    repo.markInFlight(attempt.id, "2026-08-29T00:00:00Z");
    // a driver error path (here simulated by a port that throws) must not leak the payload
    try {
      await runDeliveryAttempt(probe.conn, attempt, { async deliver() { throw new Error("driver exploded"); } });
    } catch (e) {
      assert.ok(!String((e as Error).message).includes(secretText), "error must not contain payload (I-41)");
    }
    probe.conn.close();
  });
});
// ---- SHEEP-074-PR1: startup rehydration wiring foundation (DP-178/I-115..I-119) ----

test("SHEEP-074-PR1: real startup #2 recovers workspace merchant IN_FLIGHT attempts to UNKNOWN; other merchant untouched (merchant contained)", () => {
  withTemp(async (root) => {
    const seed = openDatabase(root);
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(seed.conn));
    seedConvFor(seed.conn, wsId, "A1", "pa-A1", "conv-A1");
    seedConvFor(seed.conn, "mB", "B1", "pa-B1", "conv-B1");
    const a1 = seedAttemptOn(seed.conn, "conv-A1", "A1", "pa-A1", "A text 1");
    const a2 = seedAttemptOn(seed.conn, "conv-A1", "A1", "pa-A1", "A text 2");
    const b1 = seedAttemptOn(seed.conn, "conv-B1", "B1", "pa-B1", "B text");
    seed.conn.close();

    // startup #2: the REAL production startup composition (createWorkerBackedMainContext)
    // must run eligible recovery automatically (DP-178) - NOT a direct helper call.
    createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });

    const probe = openDatabase(root);
    const repo = new SqliteDeliveryAttemptRepository(probe.conn);
    assert.equal(repo.findById(a1)?.status, "UNKNOWN", "workspace merchant IN_FLIGHT -> UNKNOWN (DP-128)");
    assert.equal(repo.findById(a2)?.status, "UNKNOWN", "workspace merchant IN_FLIGHT -> UNKNOWN");
    assert.ok(repo.findById(a1)?.resolvedAt, "recovered attempt carries resolvedAt (local recovery fact)");
    assert.equal(repo.findById(b1)?.status, "IN_FLIGHT", "other merchant IN_FLIGHT untouched (I-119)");
    assert.equal(repo.findById(a1)?.deliveredMessageId, null, "recovery creates NO delivered message fact");
    probe.conn.close();
  });
});

test("SHEEP-074-PR1: repeated startup recovery is idempotent / no-op (I-116)", () => {
  withTemp(async (root) => {
    const seed = openDatabase(root);
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(seed.conn));
    seedConvFor(seed.conn, wsId, "A1", "pa-A1", "conv-A1");
    const a1 = seedAttemptOn(seed.conn, "conv-A1", "A1", "pa-A1", "A text");
    seed.conn.close();

    createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    const probe1 = openDatabase(root);
    const repo1 = new SqliteDeliveryAttemptRepository(probe1.conn);
    assert.equal(repo1.findById(a1)?.status, "UNKNOWN");
    assert.equal(repo1.listInFlight().length, 0);
    const resolvedAt1 = repo1.findById(a1)?.resolvedAt;
    probe1.conn.close();

    // second startup: no IN_FLIGHT remains -> recovery no-op; state not rewritten
    createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    const probe2 = openDatabase(root);
    const repo2 = new SqliteDeliveryAttemptRepository(probe2.conn);
    assert.equal(repo2.findById(a1)?.status, "UNKNOWN");
    assert.equal(repo2.findById(a1)?.resolvedAt, resolvedAt1, "resolvedAt not rewritten on repeat startup");
    assert.equal(repo2.listInFlight().length, 0);
    probe2.conn.close();
  });
});

test("SHEEP-074-PR1: recovery failure fails closed, not swallowed (I-117) - production startup aborts instead of exposing recovered state", () => {
  withTemp(async (root) => {
    const seed = openDatabase(root);
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(seed.conn));
    seedConvFor(seed.conn, wsId, "A1", "pa-A1", "conv-A1");
    seedAttemptOn(seed.conn, "conv-A1", "A1", "pa-A1", "A text");
    seed.conn.close();

    // Simulate a recovery-side failure: delivery_attempts table missing at startup.
    // openDatabase (quick_check + migrations) still succeeds; the eligible recovery
    // step then throws and MUST propagate out of the production startup composition
    // (no try/catch, no fabricated recovery success / subsystem-ready claim).
    const probe = openDatabase(root);
    probe.conn.run("DROP TABLE delivery_attempts");
    probe.conn.close();

    assert.throws(() => createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root }), "recovery failure must fail closed, not be swallowed");
  });
});

test("SHEEP-074-PR1: merchant-scoped recovery function does not swallow SQL failures (I-117)", () => {
  withTemp(async (root) => {
    const ctx = openDatabase(root);
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(ctx.conn));
    seedConvFor(ctx.conn, wsId, "A1", "pa-A1", "conv-A1");
    seedAttemptOn(ctx.conn, "conv-A1", "A1", "pa-A1", "A text");
    ctx.conn.close();
    assert.throws(() => recoverWorkspaceInFlightDeliveryAttempts(ctx.conn, wsId, "2026-08-29T02:00:00Z"));
  });
});

test("SHEEP-074-PR1: merchant-scoped recovery leaves other-merchant and unknown-owner attempts untouched (I-119); returns counts", () => {
  withTemp(async (root) => {
    const ctx = openDatabase(root);
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(ctx.conn));
    seedConvFor(ctx.conn, wsId, "A1", "pa-A1", "conv-A1");
    seedConvFor(ctx.conn, "mB", "B1", "pa-B1", "conv-B1");
    const a1 = seedAttemptOn(ctx.conn, "conv-A1", "A1", "pa-A1", "A text");
    const b1 = seedAttemptOn(ctx.conn, "conv-B1", "B1", "pa-B1", "B text");
    const res = recoverWorkspaceInFlightDeliveryAttempts(ctx.conn, wsId, "2026-08-29T02:00:00Z");
    assert.equal(res.recovered, 1, "only workspace merchant attempt recovered");
    assert.equal(res.untouchedOtherOrUnknownOwner, 1, "other merchant attempt untouched");
    const repo = new SqliteDeliveryAttemptRepository(ctx.conn);
    assert.equal(repo.findById(a1)?.status, "UNKNOWN");
    assert.equal(repo.findById(b1)?.status, "IN_FLIGHT", "other merchant untouched (I-119)");
    ctx.conn.close();
  });
});
