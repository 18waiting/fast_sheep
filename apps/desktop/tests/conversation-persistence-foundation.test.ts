import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteNormalizedConversationRepository, SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository, SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId, type NormalizedConversationRecord } from "@fastwork/persistence";
import { createWorkerBackedMainContext } from "../dist/main/worker-runtime.js";
import { createConversationIngestion } from "../dist/main/services/conversation-ingestion.js";
import type { SqliteConnection } from "@fastwork/persistence";

// SHEEP-060-PR1 foundation guards:
//   - persistence durability: fresh schema-v10 DB -> ingestion -> close -> reopen -> read
//   - production composition: createWorkerBackedMainContext binds SQLite (cross-connection proof)
//   - I-6 merchant boundary: listByMerchant/listByStore isolation, no cross-merchant leak
//   - DP-66: corrupt DB / production composition fail closed (never fall back to memory)
function tempRoot() {
  return mkdtempSync(join(tmpdir(), "fs-pr1-"));
}
function record(id: string, merchantId: string, storeId: string): NormalizedConversationRecord {
  return { id, merchantId, storeId, platformAccountId: "pa-" + storeId, externalRef: null };
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
function withTemp(fn: (root: string) => void) {
  const root = tempRoot();
  try {
    fn(root);
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort cleanup (Windows may hold open DB conns) */ }
  }
}

test("persistence durability: fresh v10 DB -> ingestion -> close -> reopen -> repository reads (PR1 layer 1)", () => {
  withTemp((root) => {
    const ctx1 = openDatabase(root);
    assert.equal(ctx1.schemaVersion, 10, "fresh DB must be schema v10");
    const repo1 = new SqliteNormalizedConversationRepository(ctx1.conn);
    seedIdentity(ctx1.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }, { id: "A2", merchantId: "m-A", platform: "pdd" }, { id: "B1", merchantId: "m-B", platform: "doudian" }]);
    const ingestion = createConversationIngestion(repo1);
    ingestion.saveNormalizedConversation(record("c1", "m-A", "A1"));
    ingestion.saveNormalizedConversation(record("c2", "m-A", "A2"));
    ingestion.saveNormalizedConversation(record("c3", "m-B", "B1"));
    ctx1.conn.close();

    // reopen same data root
    const ctx2 = openDatabase(root);
    const repo2 = new SqliteNormalizedConversationRepository(ctx2.conn);
    assert.deepEqual(repo2.listByMerchant("m-A").map((c) => c.id).sort(), ["c1", "c2"]);
    assert.deepEqual(repo2.listByStore("A1").map((c) => c.id), ["c1"]);
    assert.deepEqual(repo2.listByStore("A2").map((c) => c.id), ["c2"]);
    ctx2.conn.close();
  });
});

test("production composition binds SQLite (PR1 layer 2, cross-connection proof, DP-68)", () => {
  withTemp((root) => {
    const seedCtx = openDatabase(root);
    // SHEEP-063-PR2-PR1: establish the trusted workspace merchant identity FIRST
    // (a merchants row without a pointer is ambiguous and fails closed, I-21).
    const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(seedCtx.conn));
    assert.ok(/^merchant-/.test(wsId), "workspace merchant identity bootstrapped");
    seedIdentity(seedCtx.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }, { id: "A2", merchantId: "m-A", platform: "pdd" }]);
    seedCtx.conn.close();
    const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;
    const ctx = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.equal(ctx.workspaceMerchant?.merchantId, wsId, "composition resolves the same workspace merchant id");
    const ingestion = createConversationIngestion(ctx.conversations);
    ingestion.saveNormalizedConversation(record("pc1", "m-A", "A1"));
    ingestion.saveNormalizedConversation(record("pc2", "m-A", "A2"));

    // Independent fresh connection on the SAME data root proves the production
    // conversation source is SQLite-backed (an in-memory double would not appear here).
    const probe = openDatabase(root);
    const probeRepo = new SqliteNormalizedConversationRepository(probe.conn);
    assert.deepEqual(probeRepo.listByMerchant("m-A").map((c) => c.id).sort(), ["pc1", "pc2"]);
    probe.conn.close();
  });
});

test("I-6 merchant/store isolation: listByMerchant/listByStore no cross-merchant leak", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    const repo = new SqliteNormalizedConversationRepository(ctx.conn);
    seedIdentity(ctx.conn, [{ id: "A1", merchantId: "m-A", platform: "pdd" }, { id: "A2", merchantId: "m-A", platform: "pdd" }, { id: "B1", merchantId: "m-B", platform: "doudian" }, { id: "B2", merchantId: "m-B", platform: "doudian" }]);
    const ingestion = createConversationIngestion(repo);
    ingestion.saveNormalizedConversation(record("i1", "m-A", "A1"));
    ingestion.saveNormalizedConversation(record("i2", "m-A", "A2"));
    ingestion.saveNormalizedConversation(record("i3", "m-B", "B1"));
    ingestion.saveNormalizedConversation(record("i4", "m-B", "B2"));
    const mA = repo.listByMerchant("m-A").map((c) => c.id).sort();
    assert.deepEqual(mA, ["i1", "i2"]);
    assert.ok(!mA.includes("i3") && !mA.includes("i4"), "no cross-merchant leak into listByMerchant(m-A)");
    assert.deepEqual(repo.listByStore("A1").map((c) => c.id), ["i1"]);
    assert.deepEqual(repo.listByStore("A2").map((c) => c.id), ["i2"]);
    assert.deepEqual(repo.listByStore("B1").map((c) => c.id), ["i3"]);
    ctx.conn.close();
  });
});

test("DP-66 fail-closed: corrupt DB and production composition never fall back to memory", () => {
  withTemp((root) => {
    const ctx = openDatabase(root);
    const dbPath = ctx.dataRoot.databasePath;
    ctx.conn.close();
    writeFileSync(dbPath, "this is not a sqlite database", "utf-8");
    assert.throws(() => openDatabase(root), /integrity|corrupt|sqlite|not a database|database/i, "openDatabase must fail on corrupt DB");
    const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;
    assert.throws(
      () => createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root }),
      /integrity|corrupt|sqlite|not a database|database/i,
      "production composition must fail closed (no silent in-memory fallback)"
    );
  });
});


