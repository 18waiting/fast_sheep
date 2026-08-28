import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openDatabase, SqliteDeliveryAttemptRepository, SqliteMerchantRepository, SqliteStoreRepository,
  SqlitePlatformAccountRepository, SqliteNormalizedConversationRepository, SqliteMessageRepository,
  SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId,
  createAuthorizedDeliveryAttempt, runDeliveryAttempt, recoverInFlightAttempts, generateDeliveryAttemptId,
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
