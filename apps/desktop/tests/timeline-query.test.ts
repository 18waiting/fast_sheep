import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openDatabase, SqliteNormalizedConversationRepository, SqliteMessageRepository,
  SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository,
  SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId,
  type NormalizedConversationRepository, type StoreRepository, type PlatformAccountRepository, type MessageRepository,
} from "@fastwork/persistence";
import { QUERY_HANDLERS, type QueryDeps } from "../dist/main/ipc/query-handlers.js";
import { createConversationIngestion } from "../dist/main/services/conversation-ingestion.js";
import { createMessageIngestion } from "../dist/main/services/message-ingestion.js";
import { createWorkspaceMerchantContext } from "../dist/main/services/workspace-merchant-context.js";

// SHEEP-063 timeline query guards:
//   - DP-84: timeline reads normalized production message facts
//   - DP-85: bound to the requested conversation only (I-12 ordering from repo)
//   - DP-91/I-18: renderer conversation_id is untrusted; Main authorizes via
//     WorkspaceMerchantContext BEFORE reading messages; cross-merchant hidden as NOT_FOUND
//   - I-25/DP-48: missing authorization context -> desktop.workspace_unavailable (not empty success)
//   - purpose-built TimelineMessageView: no observed_at / external metadata
function tempRoot() { return mkdtempSync(join(tmpdir(), "fs-tlq-")); }
async function withTemp(fn: (r: string) => void | Promise<void>) {
  const r = tempRoot();
  try { await fn(r); } finally { try { rmSync(r, { recursive: true, force: true }); } catch { /* best-effort */ } }
}

function seed(root: string): { conversations: NormalizedConversationRepository; stores: StoreRepository; platformAccounts: PlatformAccountRepository; messages: MessageRepository; wsId: string } {
  const ctx = openDatabase(root);
  // trusted workspace merchant FIRST (I-20/I-21), then evidence identity under it
  const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(ctx.conn));
  const merchants = new SqliteMerchantRepository(ctx.conn);
  const stores = new SqliteStoreRepository(ctx.conn);
  const accounts = new SqlitePlatformAccountRepository(ctx.conn);
  merchants.save({ id: "m-other", name: "other-merchant" });
  stores.save({ id: "A1", merchantId: wsId, name: "A1", platform: "pdd" });
  stores.save({ id: "B1", merchantId: "m-other", name: "B1", platform: "pdd" });
  accounts.save({ id: "pa-A1", merchantId: wsId, platform: "pdd" });
  accounts.save({ id: "pa-B1", merchantId: "m-other", platform: "pdd" });
  const conversations = new SqliteNormalizedConversationRepository(ctx.conn);
  const convIng = createConversationIngestion(conversations);
  convIng.saveNormalizedConversation({ id: "conv-ws", merchantId: wsId, storeId: "A1", platformAccountId: "pa-A1", externalRef: null });
  convIng.saveNormalizedConversation({ id: "conv-other", merchantId: "m-other", storeId: "B1", platformAccountId: "pa-B1", externalRef: null });
  const messages = new SqliteMessageRepository(ctx.conn);
  const msgIng = createMessageIngestion(messages);
  // I-12: occurred_at ascending; equal-time id tie; unknown last
  msgIng.saveNormalizedMessage({ id: "m2", conversationId: "conv-ws", actor: "customer", contentKind: "text", contentText: "您好", occurredAt: "2026-08-02T00:00:00Z" });
  msgIng.saveNormalizedMessage({ id: "m1", conversationId: "conv-ws", actor: "agent", contentKind: "text", contentText: "亲，在的", occurredAt: "2026-08-01T00:00:00Z" });
  msgIng.saveNormalizedMessage({ id: "m3", conversationId: "conv-ws", actor: "customer", contentKind: "text", contentText: "时间未知的消息" });
  const platformAccounts = new SqlitePlatformAccountRepository(ctx.conn);
  return { conversations, stores, platformAccounts, messages, wsId };
}

function deps(d: { conversations: NormalizedConversationRepository; stores: StoreRepository; platformAccounts: PlatformAccountRepository; messages: MessageRepository; wsId: string }, withWorkspace = true): QueryDeps {
  return {
    conversations: d.conversations,
    stores: d.stores,
    platformAccounts: d.platformAccounts,
    messages: d.messages,
    workspaceMerchant: withWorkspace ? createWorkspaceMerchantContext(d.wsId) : null,
  } as unknown as QueryDeps;
}

test("timeline reads normalized production message facts with I-12 ordering; purpose-built view (no observed_at)", async () => {
  withTemp(async (root) => {
    const d = seed(root);
    const handler = QUERY_HANDLERS["conversations.listMessages"](deps(d));
    const res = await handler({ conversation_id: "conv-ws" });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.data.conversation_id, "conv-ws");
    // I-12: occurred_at known ascending (m1,m2), unknown last (m3)
    assert.deepEqual(res.data.messages.map((m) => m.message_id), ["m1", "m2", "m3"]);
    const m1 = res.data.messages[0];
    assert.equal(m1.actor, "agent");
    assert.equal(m1.content_kind, "text");
    assert.equal(m1.content_text, "亲，在的");
    assert.equal(m1.occurred_at, "2026-08-01T00:00:00Z");
    const m3 = res.data.messages[2];
    assert.equal(m3.occurred_at, null, "unknown occurred_at stays unknown (DP-93)");
    // purpose-built: no observed_at / external impl metadata exposed
    for (const m of res.data.messages) {
      assert.ok(!("observed_at" in m), "observed_at must not be exposed");
      assert.ok(!("external_ref" in m), "external_ref must not be exposed");
      assert.deepEqual(Object.keys(m).sort(), ["actor", "content_kind", "content_text", "message_id", "occurred_at"]);
    }
  });
});

test("unknown conversation => NOT_FOUND; cross-merchant conversation hidden as NOT_FOUND (DP-91/I-18)", async () => {
  withTemp(async (root) => {
    const d = seed(root);
    const handler = QUERY_HANDLERS["conversations.listMessages"](deps(d));
    const missing = await handler({ conversation_id: "nope" });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error.code, "desktop.not_found");
    const cross = await handler({ conversation_id: "conv-other" });
    assert.equal(cross.ok, false, "cross-merchant conversation must be denied");
    if (!cross.ok) assert.equal(cross.error.code, "desktop.not_found", "information-hiding (same as unknown)");
  });
});

test("I-25: no trusted workspace merchant => desktop.workspace_unavailable (NOT empty success)", async () => {
  withTemp(async (root) => {
    const d = seed(root);
    const handler = QUERY_HANDLERS["conversations.listMessages"](deps(d, false));
    const res = await handler({ conversation_id: "conv-ws" });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, "desktop.workspace_unavailable");
  });
});

test("authorized conversation with 0 messages => legitimate empty success", async () => {
  withTemp(async (root) => {
    const d = seed(root);
    const handler = QUERY_HANDLERS["conversations.listMessages"](deps(d));
    // use a workspace conversation that has no messages: seed only added messages to conv-ws;
    // create an empty one under ws
    const ctx = openDatabase(root);
    const convs = new SqliteNormalizedConversationRepository(ctx.conn);
    const convIng = createConversationIngestion(convs);
    convIng.saveNormalizedConversation({ id: "conv-empty", merchantId: d.wsId, storeId: "A1", platformAccountId: "pa-A1", externalRef: null });
    ctx.conn.close();
    const handler2 = QUERY_HANDLERS["conversations.listMessages"](deps(d));
    const res2 = await handler2({ conversation_id: "conv-empty" });
    assert.equal(res2.ok, true, "authorized 0-row is a legitimate empty success");
    if (res2.ok) assert.deepEqual(res2.data.messages, []);
  });
});

test("missing conversation_id => INVALID_REQUEST", async () => {
  withTemp(async (root) => {
    const d = seed(root);
    const handler = QUERY_HANDLERS["conversations.listMessages"](deps(d));
    const res = await handler({ conversation_id: "" });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, "desktop.invalid_request");
  });
});
