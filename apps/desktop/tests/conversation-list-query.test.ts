import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteNormalizedConversationRepository, SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository, type NormalizedConversationRepository, type StoreRepository, type PlatformAccountRepository } from "@fastwork/persistence";
import { QUERY_HANDLERS, type QueryDeps } from "../dist/main/ipc/query-handlers.js";
import { createConversationIngestion } from "../dist/main/services/conversation-ingestion.js";
import { createWorkspaceMerchantContext } from "../dist/main/services/workspace-merchant-context.js";
import type { QueueScope } from "@fastwork/desktop-ipc";

// SHEEP-060 query-layer guards: conversations.list is merchant-constrained (I-6),
// deterministic technical ordering by conversation_id (DP-63), minimal items (DP-58),
// no fake storeId="all" (I-2), unknown store => NOT_FOUND.
// SHEEP-063-PR2 (DP-94/98/I-18): the merchant authority is the Main-owned
// WorkspaceMerchantContext — NOT Queue Scope / selected shop. Cross-merchant
// stores are denied (NOT_FOUND); without a workspace merchant the handler fails
// closed (empty, no leak).
function tempRoot() { return mkdtempSync(join(tmpdir(), "fs-q-")); }

function seed(root: string): { conversations: NormalizedConversationRepository; stores: StoreRepository } {
  const ctx = openDatabase(root);
  const m = new SqliteMerchantRepository(ctx.conn);
  const s = new SqliteStoreRepository(ctx.conn);
  const pa = new SqlitePlatformAccountRepository(ctx.conn);
  m.save({ id: "m-A", name: "A" });
  m.save({ id: "m-B", name: "B" });
  for (const st of [["A1", "m-A"], ["A2", "m-A"], ["B1", "m-B"]] as const) {
    s.save({ id: st[0], merchantId: st[1], name: st[0], platform: "pdd" });
    pa.save({ id: "pa-" + st[0], merchantId: st[1], platform: st[1] === "m-B" ? "doudian" : "pdd" });
  }
  const conversations = new SqliteNormalizedConversationRepository(ctx.conn);
  const ingestion = createConversationIngestion(conversations);
  ingestion.saveNormalizedConversation({ id: "c-a1", merchantId: "m-A", storeId: "A1", platformAccountId: "pa-A1", externalRef: null });
  ingestion.saveNormalizedConversation({ id: "c-a2", merchantId: "m-A", storeId: "A2", platformAccountId: "pa-A2", externalRef: null });
  ingestion.saveNormalizedConversation({ id: "c-b1", merchantId: "m-B", storeId: "B1", platformAccountId: "pa-B1", externalRef: null });
  pa.save({ id: "pa-A1-dd", merchantId: "m-A", platform: "doudian" });
  ingestion.saveNormalizedConversation({ id: "c-a2-dd", merchantId: "m-A", storeId: "A1", platformAccountId: "pa-A1-dd", externalRef: null });
  const stores = new SqliteStoreRepository(ctx.conn);
  const platformAccounts = new SqlitePlatformAccountRepository(ctx.conn);
  return { conversations, stores, platformAccounts };
}

// workspaceMerchantId is the ONLY merchant authority (DP-94/98). selectedShop is
// intentionally NOT part of the query deps anymore (selected shop is not authority).
function deps(conversations: NormalizedConversationRepository, stores: StoreRepository, workspaceMerchantId: string | null, platformAccounts?: PlatformAccountRepository): QueryDeps {
  return {
    conversations,
    stores,
    platformAccounts: platformAccounts ?? ({} as PlatformAccountRepository),
    workspaceMerchant: workspaceMerchantId === null ? null : createWorkspaceMerchantContext(workspaceMerchantId),
  } as unknown as QueryDeps;
}

test("conversations.list specific_store is workspace-merchant-contained (I-6/DP-63/DP-98)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores, platformAccounts } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "m-A", platformAccounts));
    const r1 = await handler({ scope: { kind: "specific_store", storeId: "A1" } });
    assert.equal(r1.ok, true);
    if (r1.ok) assert.deepEqual(r1.data.items.map((i) => i.conversation_id), ["c-a1", "c-a2-dd"]);
    const r2 = await handler({ scope: { kind: "specific_store", storeId: "A2" } });
    if (r2.ok) assert.deepEqual(r2.data.items.map((i) => i.conversation_id), ["c-a2"]);
    // I-18/DP-98: store B1 belongs to merchant m-B — NOT in workspace m-A -> denied
    // (cross-merchant; no existence leak).
    const rb = await handler({ scope: { kind: "specific_store", storeId: "B1" } });
    assert.equal(rb.ok, false);
    if (!rb.ok) assert.equal(rb.error.code, "desktop.not_found");
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { }
  }
});

test("conversations.list unknown store => NOT_FOUND; all_stores bounded by workspace merchant (no cross-merchant leak)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores, platformAccounts } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "m-A", platformAccounts));
    const bad = await handler({ scope: { kind: "specific_store", storeId: "nope" } });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error.code, "desktop.not_found");
    const all = await handler({ scope: { kind: "all_stores" } });
    assert.equal(all.ok, true);
    if (all.ok) {
      const ids = all.data.items.map((i) => i.conversation_id).sort();
      assert.deepEqual(ids, ["c-a1", "c-a2", "c-a2-dd"], "all_stores bounded by workspace merchant A; B not leaked");
    }
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { }
  }
});

test("I-25: no trusted workspace merchant -> explicit unavailable failure, NOT empty success (DP-48)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores, platformAccounts } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, null, platformAccounts));
    const all = await handler({ scope: { kind: "all_stores" } });
    assert.equal(all.ok, false, "missing authorization context must not be a successful empty queue");
    if (!all.ok) assert.equal(all.error.code, "desktop.workspace_unavailable");
  } finally { try { rmSync(root, { recursive: true, force: true }); } catch { } }
});

test("valid workspace merchant + 0 conversations -> legitimate empty success (no-work)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores } = seed(root);
    // new workspace merchant with NO conversations under it
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "m-empty"));
    const all = await handler({ scope: { kind: "all_stores" } });
    assert.equal(all.ok, true, "authorized query with 0 rows is a legitimate empty success");
    if (all.ok) {
      assert.deepEqual(all.data.items, [], "no-work queue");
      assert.ok(Array.isArray(all.data.stores));
    }
  } finally { try { rmSync(root, { recursive: true, force: true }); } catch { } }
});

test("QueueScope has no pseudo storeId=\"all\" at query layer (I-2)", () => {
  const src = readFileSync(pathJoin(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "conversation-list.ts"), "utf-8");
  assert.ok(!src.includes('storeId: "all"'));
});
test("platform filter composes by intersection (I-8): store ∩ platform", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores, platformAccounts } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "m-A", platformAccounts));
    const r = await handler({ scope: { kind: "specific_store", storeId: "A1" }, platform: "doudian" });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.data.items.map((i) => i.conversation_id), ["c-a2-dd"], "A1 + doudian => only doudian conversation");
    const r2 = await handler({ scope: { kind: "specific_store", storeId: "A1" }, platform: "pdd" });
    if (r2.ok) assert.deepEqual(r2.data.items.map((i) => i.conversation_id), ["c-a1"], "A1 + pdd => only pdd conversation");
  } finally { try { rmSync(root, { recursive: true, force: true }); } catch { } }
});

test("all_stores + platform filter stays merchant-bounded (I-6/I-8), options fact-backed (DP-77)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores, platformAccounts } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "m-A", platformAccounts));
    const r = await handler({ scope: { kind: "all_stores" }, platform: "doudian" });
    assert.equal(r.ok, true);
    if (r.ok) {
      const ids = r.data.items.map((i) => i.conversation_id).sort();
      assert.deepEqual(ids, ["c-a2-dd"], "all_stores + doudian => merchant A doudian only (no B leak)");
      assert.ok(r.data.stores.some((s) => s.store_id === "A1") && r.data.stores.some((s) => s.store_id === "A2"), "stores option fact-backed");
      assert.ok(r.data.platforms.includes("pdd") && r.data.platforms.includes("doudian"), "platforms option canonical");
    }
  } finally { try { rmSync(root, { recursive: true, force: true }); } catch { } }
});

test("platform filter validates canonical identity (DP-71): unknown platform yields empty, no crash", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores, platformAccounts } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "m-A", platformAccounts));
    const r = await handler({ scope: { kind: "all_stores" }, platform: "pdd" as never });
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(Array.isArray(r.data.items));
  } finally { try { rmSync(root, { recursive: true, force: true }); } catch { } }
});
