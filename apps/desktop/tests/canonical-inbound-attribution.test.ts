// SHEEP-301 identity attribution: conversation identity must come from the trusted per-customer
// association, never from a shared constant, and an external reference that does not match its
// contract shape must stay explicitly UNKNOWN instead of being stringified into a fake id.
//
// Defect history this file guards against (observed in the controlled observation writes):
//   - every customer was written into ONE hardcoded conversation id, so a conversation could hold
//     messages from different customers;
//   - the conversation external reference was written as "[object Object]" because a contract-shaped
//     `ConversationExternalRef` ({ value: string }) was passed through String(object).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteMessageRepository, SqliteNormalizedConversationRepository } from "@fastwork/persistence";
import type { InboundEnvelope } from "@fastwork/domain";
import { createCanonicalInboundPersistence } from "../dist/main/services/canonical-inbound-persistence.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";
import { deriveInternalConversationId } from "@fastwork/platform-pdd";

function resolution(value: unknown) {
  return value === undefined ? { status: "UNKNOWN" as const } : { status: "RESOLVED" as const, value };
}

interface MessageOptions {
  conversationId: string;
  customerUid: string;
  reference: unknown;
  msgId: string;
  content?: string;
  shopId?: string;
  merchant?: string;
  store?: string;
  account?: string;
}

function envelopeFor(opts: MessageOptions): InboundEnvelope {
  const shopId = opts.shopId ?? "shop-attribution-test";
  const merchantId = opts.merchant ?? "merchant-attribution-test";
  return {
    identityLock: {
      platform: "pdd",
      runtimeShop: resolution({ value: shopId }),
      merchantId: resolution(merchantId),
      storeId: resolution(opts.store ?? "store-attribution-test"),
      platformAccountId: resolution(opts.account ?? "account-attribution-test"),
      platformCustomerId: resolution({ value: opts.customerUid }),
      internalConversationId: resolution(opts.conversationId),
      runtimeConversationReference: resolution(opts.reference),
      triggerMessage: {
        localMessageId: resolution("local-" + opts.msgId),
        platformMessageIdentity: { provenance: "AUTHORITATIVE_PLATFORM_ID", value: opts.msgId },
      },
    },
    sourceContent: { kind: "text", text: opts.content ?? "hello" },
    sourceOccurredAt: "2026-09-20T00:00:01Z",
  } as InboundEnvelope;
}

interface ScopeSeed { store: string; account: string; shopId: string }

function withDatabase(
  fn: (ctx: { ingest: (envelope: InboundEnvelope) => { status: string }; conversations: SqliteNormalizedConversationRepository; messages: SqliteMessageRepository; dir: string }) => void,
  extraScopes: ScopeSeed[] = [],
) {
  const dir = mkdtempSync(join(tmpdir(), "fastwork-attribution-"));
  const db = openDatabase(dir, { seed: true });
  db.conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES (?, ?)", "merchant-attribution-test", "Attribution TEST merchant");
  db.conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES (?, ?, ?, ?)", "store-attribution-test", "merchant-attribution-test", "Attribution TEST store", "pdd");
  db.conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform, external_ref) VALUES (?, ?, ?, ?)", "account-attribution-test", "merchant-attribution-test", "pdd", "shop-attribution-test");
  for (const scope of extraScopes) {
    db.conn.run("INSERT OR IGNORE INTO stores (id, merchant_id, name, platform) VALUES (?, ?, ?, ?)", scope.store, "merchant-attribution-test", "Attribution TEST store " + scope.store, "pdd");
    db.conn.run("INSERT OR IGNORE INTO platform_accounts (id, merchant_id, platform, external_ref) VALUES (?, ?, ?, ?)", scope.account, "merchant-attribution-test", "pdd", scope.shopId);
  }
  const conversations = new SqliteNormalizedConversationRepository(db.conn);
  const messages = new SqliteMessageRepository(db.conn);
  const persistence = createCanonicalInboundPersistence({ conversations, messages });
  try {
    fn({ ingest: (envelope) => persistence.ingest(envelope), conversations, messages, dir });
  } finally {
    db.conn.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("different customers never share one conversation", () => {
  withDatabase(({ ingest, conversations, messages }) => {
    const first = ingest(envelopeFor({ conversationId: "conversation-1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-1001-a" }));
    const second = ingest(envelopeFor({ conversationId: "conversation-1002", customerUid: "1002", reference: { value: "runtime-1002" }, msgId: "msg-1002-a" }));
    assert.equal(first.status, "INGESTED");
    assert.equal(second.status, "INGESTED");
    assert.notEqual(first.conversationId, second.conversationId, "each customer keeps its own conversation");

    const rows = messages.listByConversation(first.conversationId);
    assert.equal(rows.length, 1, "the first conversation holds only its own message");
    assert.equal(rows[0].externalRef, "msg-1001-a");
    assert.equal(messages.listByConversation(second.conversationId).length, 1);

    const firstConversation = conversations.findById("conversation-1001");
    const secondConversation = conversations.findById("conversation-1002");
    assert.ok(firstConversation && secondConversation);
    assert.equal(firstConversation.externalRef, "runtime-1001", "reference is stored verbatim, per customer");
    assert.equal(secondConversation.externalRef, "runtime-1002");
    assert.notEqual(firstConversation.externalRef, secondConversation.externalRef);
  });
});

test("the same customer's duplicate message still deduplicates", () => {
  withDatabase(({ ingest, messages }) => {
    const first = ingest(envelopeFor({ conversationId: "conversation-1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-1001-a" }));
    const repeat = ingest(envelopeFor({ conversationId: "conversation-1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-1001-a" }));
    assert.equal(first.status, "INGESTED");
    assert.equal(repeat.status, "DUPLICATE");
    assert.equal(messages.listByConversation("conversation-1001").length, 1, "one row for one platform message");

    const other = ingest(envelopeFor({ conversationId: "conversation-1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-1001-b" }));
    assert.equal(other.status, "INGESTED");
    assert.equal(messages.listByConversation("conversation-1001").length, 2);
  });
});

test("a reference that violates its contract stays explicitly UNKNOWN instead of becoming '[object Object]'", () => {
  const violating = [
    { value: { nested: "conversation-real-observation" } },
    { value: "" },
    { value: 42 },
    { value: "runtime-1001", extra: true },
  ];
  withDatabase(({ ingest, conversations }) => {
    violating.forEach((reference, index) => {
      const envelope = envelopeFor({ conversationId: "conversation-100" + index, customerUid: "100" + index, reference, msgId: "msg-100" + index });
      const result = ingest(envelope);
      assert.equal(result.status, "INGESTED");
      const conversation = conversations.findById("conversation-100" + index);
      assert.ok(conversation);
      assert.equal(conversation.externalRef, null, "no fabricated reference: explicit UNKNOWN");
      assert.notEqual(conversation.externalRef, "[object Object]");
    });
  });
});

test("an UNRESOLVED reference stays null (never invented)", () => {
  withDatabase(({ ingest, conversations }) => {
    const result = ingest(envelopeFor({ conversationId: "conversation-1009", customerUid: "1009", reference: undefined, msgId: "msg-1009" }));
    assert.equal(result.status, "INGESTED");
    assert.equal(conversations.findById("conversation-1009")?.externalRef, null);
  });
});

test("a valid contract reference is stored exactly, and is not shared across customers", () => {
  withDatabase(({ ingest, conversations }) => {
    ingest(envelopeFor({ conversationId: "conversation-2001", customerUid: "2001", reference: { value: "runtime-2001" }, msgId: "msg-2001" }));
    ingest(envelopeFor({ conversationId: "conversation-2002", customerUid: "2002", reference: { value: "runtime-2002" }, msgId: "msg-2002" }));
    const stored = [conversations.findById("conversation-2001")?.externalRef, conversations.findById("conversation-2002")?.externalRef];
    assert.deepEqual(stored, ["runtime-2001", "runtime-2002"]);
    assert.equal(stored.includes("[object Object]"), false);
  });
});

test("the same platform customer id in two shops stays isolated (scoped conversation ids)", () => {
  const scopes = [{ store: "store-attribution-b", account: "account-attribution-b", shopId: "shop-attribution-b" }];
  withDatabase(({ ingest, conversations, messages }) => {
    // Same platformCustomerId and even the same platform message id in both shops.
    const shopA = ingest(envelopeFor({ conversationId: "conversation:account-attribution-test:1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-shared-1" }));
    const shopB = ingest(envelopeFor({
      conversationId: "conversation:account-attribution-b:1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-shared-1",
      store: "store-attribution-b", account: "account-attribution-b", shopId: "shop-attribution-b",
    }));
    assert.equal(shopA.status, "INGESTED");
    assert.equal(shopB.status, "INGESTED", "the same opaque ids in another shop are not treated as duplicates");
    assert.notEqual(shopA.conversationId, shopB.conversationId);
    assert.equal(messages.listByConversation(shopA.conversationId).length, 1);
    assert.equal(messages.listByConversation(shopB.conversationId).length, 1);
    assert.equal(conversations.findById(shopA.conversationId)?.platformAccountId, "account-attribution-test");
    assert.equal(conversations.findById(shopB.conversationId)?.platformAccountId, "account-attribution-b");
    assert.equal(conversations.findById(shopB.conversationId)?.storeId, "store-attribution-b");
  }, scopes);
});

test("an unscoped conversation id that collides across shops fails closed instead of mixing shops", () => {
  const scopes = [{ store: "store-attribution-b", account: "account-attribution-b", shopId: "shop-attribution-b" }];
  withDatabase(({ ingest, conversations, messages }) => {
    const shopA = ingest(envelopeFor({ conversationId: "conversation-1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-shared-1" }));
    assert.equal(shopA.status, "INGESTED");
    const before = messages.listByConversation("conversation-1001").length;

    // Same unscoped conversation id from a different shop, with the SAME message id: the scope
    // conflict must win over dedupe, so the message is never silently reported as a duplicate.
    assert.throws(
      () => ingest(envelopeFor({
        conversationId: "conversation-1001", customerUid: "1001", reference: { value: "runtime-1001" }, msgId: "msg-shared-1",
        store: "store-attribution-b", account: "account-attribution-b", shopId: "shop-attribution-b",
      })),
      (error: { reason?: string }) => error.reason === "CONVERSATION_SCOPE_CONFLICT",
    );
    assert.equal(messages.listByConversation("conversation-1001").length, before, "shop A data is unchanged");
    assert.equal(conversations.findById("conversation-1001")?.platformAccountId, "account-attribution-test");
    assert.equal(conversations.findById("conversation-1001")?.storeId, "store-attribution-test");
  }, scopes);
});

test("the real identity derivation isolates two shops with the same customer and the same message id", () => {
  const shopA = { merchant: "merchant-attribution-test", store: "store-attribution-test", account: "account-attribution-test", shopId: "shop-attribution-test" };
  const shopB = { merchant: "merchant-attribution-test", store: "store-attribution-b", account: "account-attribution-b", shopId: "shop-attribution-b" };
  const sharedCustomerUid = "2318082461";
  const sharedMessageId = "1789900000001";

  function mapThroughRealResolver(shop: typeof shopA) {
    const document = { sessionId: "pdd-session-" + shop.shopId, shopId: shop.shopId, documentGeneration: 1 };
    const scope = () => ({
      merchantId: resolution(shop.merchant),
      storeId: resolution(shop.store),
      platformAccountId: resolution(shop.account),
    });
    return processPddInboundIngress({
      document,
      input: {
        payload: {
          from: { role: "user", uid: sharedCustomerUid },
          to: { role: "mall_cs", uid: "1000000000003" },
          content: "shared content",
          msg_id: sharedMessageId,
        },
        sourceOccurredAt: "2026-09-20T00:00:01Z",
      },
      resolveScope: scope,
      resolveIdentity: (message, doc) => {
        const conversationId = deriveInternalConversationId({ platformAccountId: shop.account }, message.customerUid);
        if (conversationId === null) return null;
        return {
          runtimeShop: resolution({ value: doc.shopId }),
          scope: scope(),
          // No platform-grounded conversation reference was observed for this sample: UNKNOWN.
          runtimeConversationReference: resolution(undefined),
          association: {
            ownerRuntimeShopId: doc.shopId,
            ownerScope: scope(),
            platformCustomerId: message.customerUid,
            platformMessageId: message.platformMessageId,
            internalConversationId: resolution(conversationId),
            localMessageId: resolution("local-" + message.platformMessageId),
          },
        };
      },
      canonicalValidator: undefined,
    });
  }

  withDatabase(({ ingest, conversations, messages }) => {
    const mappedA = mapThroughRealResolver(shopA);
    const mappedB = mapThroughRealResolver(shopB);
    assert.equal(mappedA.status, "MAPPED");
    assert.equal(mappedB.status, "MAPPED");
    if (mappedA.status !== "MAPPED" || mappedB.status !== "MAPPED") return;

    const first = ingest(mappedA.envelope);
    const second = ingest(mappedB.envelope);
    assert.equal(first.status, "INGESTED");
    assert.equal(second.status, "INGESTED", "the other shop's identical ids are not deduplicated away");
    assert.notEqual(first.conversationId, second.conversationId);
    assert.equal(first.conversationId, "conversation:" + shopA.account + ":" + sharedCustomerUid);
    assert.equal(second.conversationId, "conversation:" + shopB.account + ":" + sharedCustomerUid);
    assert.equal(messages.listByConversation(first.conversationId).length, 1);
    assert.equal(messages.listByConversation(second.conversationId).length, 1);

    const storedA = conversations.findById(first.conversationId);
    const storedB = conversations.findById(second.conversationId);
    assert.equal(storedA?.platformAccountId, shopA.account);
    assert.equal(storedA?.storeId, shopA.store);
    assert.equal(storedB?.platformAccountId, shopB.account);
    assert.equal(storedB?.storeId, shopB.store);
    assert.equal(storedA?.externalRef, null, "no platform-grounded reference was observed: explicit UNKNOWN");
    assert.equal(storedB?.externalRef, null);
  }, [{ store: shopB.store, account: shopB.account, shopId: shopB.shopId }]);
});

test("the derivation fails closed (explicit UNKNOWN) when the platform facts are insufficient", () => {
  assert.equal(deriveInternalConversationId({ platformAccountId: "" }, "1001"), null);
  assert.equal(deriveInternalConversationId({ platformAccountId: "account-1" }, ""), null);
  assert.equal(deriveInternalConversationId({ platformAccountId: "account-1" }, "not-a-uid"), null);
  assert.equal(deriveInternalConversationId({ platformAccountId: "account-1" }, undefined), null);
  assert.equal(deriveInternalConversationId(null as never, "1001"), null);
  assert.equal(deriveInternalConversationId({ platformAccountId: "account-1" }, "1001"), "conversation:account-1:1001");
});
