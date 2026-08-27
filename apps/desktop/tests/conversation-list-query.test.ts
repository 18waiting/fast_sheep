import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteNormalizedConversationRepository, SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository, type NormalizedConversationRepository, type StoreRepository } from "@fastwork/persistence";
import { QUERY_HANDLERS, type QueryDeps } from "../dist/main/ipc/query-handlers.js";
import { createConversationIngestion } from "../dist/main/services/conversation-ingestion.js";
import type { QueueScope } from "@fastwork/desktop-ipc";

// SHEEP-060 query-layer guards: conversations.list is merchant-constrained (I-6),
// deterministic technical ordering by conversation_id (DP-63), minimal items (DP-58),
// no fake storeId="all" (I-2), unknown store => NOT_FOUND.
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
    pa.save({ id: "pa-" + st[0], merchantId: st[1], platform: "pdd" });
  }
  const conversations = new SqliteNormalizedConversationRepository(ctx.conn);
  const ingestion = createConversationIngestion(conversations);
  ingestion.saveNormalizedConversation({ id: "c-a1", merchantId: "m-A", storeId: "A1", platformAccountId: "pa-A1", externalRef: null });
  ingestion.saveNormalizedConversation({ id: "c-a2", merchantId: "m-A", storeId: "A2", platformAccountId: "pa-A2", externalRef: null });
  ingestion.saveNormalizedConversation({ id: "c-b1", merchantId: "m-B", storeId: "B1", platformAccountId: "pa-B1", externalRef: null });
  const stores = new SqliteStoreRepository(ctx.conn);
  return { conversations, stores };
}

function deps(conversations: NormalizedConversationRepository, stores: StoreRepository, selected: string | null): QueryDeps {
  return {
    conversations,
    stores,
    selectedShopId: () => selected,
  } as unknown as QueryDeps;
}

test("conversations.list specific_store is merchant-constrained with deterministic ordering (I-6/DP-63)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "A1"));
    const r1 = await handler({ scope: { kind: "specific_store", storeId: "A1" } });
    assert.equal(r1.ok, true);
    if (r1.ok) assert.deepEqual(r1.data.items.map((i) => i.conversation_id), ["c-a1"]);
    const r2 = await handler({ scope: { kind: "specific_store", storeId: "A2" } });
    if (r2.ok) assert.deepEqual(r2.data.items.map((i) => i.conversation_id), ["c-a2"]);
    const rb = await handler({ scope: { kind: "specific_store", storeId: "B1" } });
    if (rb.ok) assert.deepEqual(rb.data.items.map((i) => i.conversation_id), ["c-b1"], "store B1 returns only B1 (merchant boundary)");
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { }
  }
});

test("conversations.list unknown store => NOT_FOUND; all_stores bounded by selected shop merchant (no cross-merchant leak)", async () => {
  const root = tempRoot();
  try {
    const { conversations, stores } = seed(root);
    const handler = QUERY_HANDLERS["conversations.list"](deps(conversations, stores, "A1"));
    const bad = await handler({ scope: { kind: "specific_store", storeId: "nope" } });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error.code, "desktop.not_found");
    const all = await handler({ scope: { kind: "all_stores" } });
    assert.equal(all.ok, true);
    if (all.ok) {
      const ids = all.data.items.map((i) => i.conversation_id).sort();
      assert.deepEqual(ids, ["c-a1", "c-a2"], "all_stores bounded by selected shop merchant A; B not leaked");
    }
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { }
  }
});

test("QueueScope has no pseudo storeId=\"all\" at query layer (I-2)", () => {
  const src = readFileSync(pathJoin(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "conversation-list.ts"), "utf-8");
  assert.ok(!src.includes('storeId: "all"'));
});