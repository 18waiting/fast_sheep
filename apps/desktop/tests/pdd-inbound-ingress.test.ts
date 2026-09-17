import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";

class FakeView {
  visible = false;
  disposed = false;
  webContents: { destroyed: boolean; send(): void; isDestroyed(): boolean };
  constructor() {
    const wc = { destroyed: false, send: () => {} };
    this.webContents = { ...wc, isDestroyed: () => wc.destroyed };
  }
  async loadLocalFixture(): Promise<void> {}
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(): void {}
  dispose(): void { this.disposed = true; this.webContents.destroyed = true; }
  get isVisible(): boolean { return this.visible; }
}

function resolution(value: unknown) {
  return value === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value };
}

const defaultScope = () => ({
  merchantId: resolution("merchant-1"),
  storeId: resolution("store-1"),
  platformAccountId: resolution("account-1"),
});

const controlledAssociations = new Map<string, { conversation: string; localMessage: string }>([
  ["6318084722818|pdd-message-1", { conversation: "conversation-1", localMessage: "local-message-1" }],
  ["1|same", { conversation: "same-conversation", localMessage: "same-local-message" }],
  ["1001|m-a", { conversation: "conversation-a", localMessage: "local-message-a" }],
  ["1001|same-id", { conversation: "conversation-1", localMessage: "local-message-a" }],
  ["1002|same-id", { conversation: "conversation-2", localMessage: "local-message-b" }],
  ["A|m-a", { conversation: "conversation-a", localMessage: "local-message-a" }],
  ["B|m-b", { conversation: "conversation-b", localMessage: "local-message-b" }],
]);

function associationFor(document: { shopId: string }, message: { customerUid?: string; platformMessageId?: string }) {
  if (message.customerUid === undefined || message.platformMessageId === undefined) return undefined;
  const record = controlledAssociations.get(message.customerUid + "|" + message.platformMessageId);
  if (!record) return undefined;
  return {
    ownerRuntimeShopId: document.shopId,
    ownerScope: defaultScope(),
    platformCustomerId: message.customerUid,
    platformMessageId: message.platformMessageId,
    internalConversationId: resolution(record.conversation),
    localMessageId: resolution(record.localMessage),
  };
}

function baseIdentity(document: { shopId: string }, message: { customerUid?: string; platformMessageId?: string }) {
  return {
    runtimeShop: resolution({ value: document.shopId }),
    scope: defaultScope(),
    runtimeConversationReference: resolution({ value: "runtime-" + document.shopId }),
    association: associationFor(document, message),
  } as never;
}

function makeService(options: Record<string, unknown> = {}) {
  const collected: Array<Record<string, unknown>> = [];
  const calls = { ai: 0, human: 0, focus: 0, legacyInbound: 0 };
  const views: FakeView[] = [];
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: {
      onBuyerMessage: async () => { calls.ai += 1; },
      onHumanTakeover: async () => { calls.human += 1; },
      onFocusShop: () => { calls.focus += 1; },
    } as never,
    fixturePathFor: () => "/fixture.html",
    makeView: () => {
      const view = new FakeView();
      views.push(view);
      return view as never;
    },
    resolveInboundScope: options.resolveScope === undefined
      ? () => defaultScope()
      : options.resolveScope as never,
    resolveInboundIdentity: (message: never, document: never) =>
      options.resolveIdentity === undefined
        ? baseIdentity(document, message)
        : (options.resolveIdentity as (message: unknown, document: unknown) => unknown)(message, document),
    onInboundMessage: async () => { calls.legacyInbound += 1; },
    onCanonicalInbound: options.collector === null
      ? undefined
      : ((options.collector as ((envelope: unknown) => unknown) | undefined) ?? ((envelope: unknown) => { collected.push(envelope as Record<string, unknown>); })),
    canonicalEnvelopeValidator: options.canonicalValidator as never,
  });
  return { service, collected, calls, views };
}

async function makeReady(shopId = "shop-a") {
  const harness = makeService();
  await harness.service.activate(shopId);
  harness.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-" + shopId, shop_id: shopId } as never);
  const sender = harness.service.webContentsFor(shopId)!;
  const context = harness.service.createInboundIngressContext(sender);
  assert.ok(context);
  return { ...harness, sender, context };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    content: "  请问什么时候发货？\n",
    from: { role: "user", uid: "6318084722818" },
    to: { role: "mall_cs", uid: "opaque-cs" },
    msg_id: "pdd-message-1",
    ...overrides,
  };
}

test("valid fixture ingress maps through real service, host, mapper, and default schema validator", async () => {
  const h = await makeReady();
  const result = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-09-17T12:00:00Z" });
  assert.equal(result.status, "MAPPED");
  assert.equal(h.collected.length, 1);
  assert.equal((h.collected[0] as { sourceContent: { text: string } }).sourceContent.text, "  请问什么时候发货？\n");
  assert.equal(h.calls.ai, 0);
  assert.equal(h.calls.legacyInbound, 0);
});

test("missing UID and msg_id remain explicit UNKNOWN and do not fabricate association", async () => {
  const h = await makeReady();
  const result = h.service.handleTrustedInboundIngress(h.sender, h.context, {
    payload: { content: "hello", from: { role: "user" }, to: { role: "mall_cs" } },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.identityLock.platformCustomerId.status, "UNKNOWN");
  assert.equal(result.envelope.identityLock.triggerMessage.platformMessageIdentity.provenance, "UNKNOWN");
  assert.equal(result.envelope.identityLock.internalConversationId.status, "UNKNOWN");
  assert.equal(result.envelope.identityLock.triggerMessage.localMessageId.status, "UNKNOWN");
});

test("present-but-invalid UID or msg_id rejects", async () => {
  const h = await makeReady();
  assert.equal(h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ from: { role: "user", uid: "buyer-1" } }) }).status, "REJECTED");
  assert.equal(h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ msg_id: " " }) }).status, "REJECTED");
  assert.equal(h.collected.length, 0);
});

test("runtimeShop mismatch is rejected before collector", async () => {
  const h = makeService({
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      ...baseIdentity(document, { customerUid: "6318084722818", platformMessageId: "pdd-message-1" }),
      runtimeShop: resolution({ value: "shop-b" }),
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, "RUNTIME_SHOP_MISMATCH");
  assert.equal(h.collected.length, 0);
});

test("canonical scope mismatch is rejected before collector", async () => {
  const h = makeService({
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      ...baseIdentity(document, { customerUid: "6318084722818", platformMessageId: "pdd-message-1" }),
      scope: { merchantId: resolution("merchant-other"), storeId: resolution("store-other"), platformAccountId: resolution("account-other") },
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, "CANONICAL_SCOPE_MISMATCH");
  assert.equal(h.collected.length, 0);
});

test("reused per-message association for a different customer is rejected", async () => {
  const h = makeService({
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      ...baseIdentity(document, { customerUid: "1001", platformMessageId: "m-a" }),
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const first = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload({ content: "first", from: { role: "user", uid: "1001" }, msg_id: "m-a" }) });
  const second = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload({ content: "second", from: { role: "user", uid: "1002" }, msg_id: "m-b" }) });
  assert.equal(first.status, "MAPPED");
  assert.equal(second.status, "REJECTED");
  assert.equal(second.reason, "CUSTOMER_ASSOCIATION_MISMATCH");
  assert.equal(h.collected.length, 1);
});

test("same message ID in different correctly associated conversations reaches output twice", async () => {
  const h = await makeReady();
  const first = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "first", from: { role: "user", uid: "1001" }, msg_id: "same-id" }) });
  const second = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "second", from: { role: "user", uid: "1002" }, msg_id: "same-id" }) });
  assert.equal(first.status, "MAPPED");
  assert.equal(second.status, "MAPPED");
  assert.equal(h.collected.length, 2);
});

test("two shops with equal customer/message identifiers remain isolated", async () => {
  const a = await makeReady("shop-a");
  const b = await makeReady("shop-b");
  const payload = validPayload({ content: "same", from: { role: "user", uid: "1" }, msg_id: "same" });
  assert.equal(a.service.handleTrustedInboundIngress(a.sender, a.context, { payload }).status, "MAPPED");
  assert.equal(b.service.handleTrustedInboundIngress(b.sender, b.context, { payload }).status, "MAPPED");
  assert.equal((a.collected[0] as { identityLock: { runtimeShop: { value: { value: string } } } }).identityLock.runtimeShop.value.value, "shop-a");
  assert.equal((b.collected[0] as { identityLock: { runtimeShop: { value: { value: string } } } }).identityLock.runtimeShop.value.value, "shop-b");
});

test("wrong shop/session/context and stale document context are rejected", async () => {
  const a = await makeReady("shop-a");
  await a.service.activate("shop-b");
  a.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-b", shop_id: "shop-b" } as never);
  const bSender = a.service.webContentsFor("shop-b")!;
  assert.equal(a.service.handleTrustedInboundIngress(bSender, a.context, { payload: validPayload() }).reason, "INVALID_DOCUMENT_CONTEXT");
  assert.equal(a.service.handleTrustedInboundIngress(a.sender, {}, { payload: validPayload() }).reason, "INVALID_DOCUMENT_CONTEXT");
  await a.service.reload("shop-a");
  a.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  assert.equal(a.service.handleTrustedInboundIngress(a.sender, a.context, { payload: validPayload() }).reason, "INVALID_DOCUMENT_CONTEXT");
});

test("dispose/recreate invalidates old context regardless of repeated labels", async () => {
  const h = await makeReady("shop-a");
  const oldContext = h.context;
  const oldSender = h.sender;
  h.service.disposeAll();
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const newSender = h.service.webContentsFor("shop-a")!;
  assert.equal(h.service.handleTrustedInboundIngress(newSender, oldContext, { payload: validPayload() }).reason, "INVALID_DOCUMENT_CONTEXT");
  assert.equal(h.service.handleTrustedInboundIngress(oldSender, oldContext, { payload: validPayload() }).reason, "UNTRUSTED_SENDER");
});

test("selected observation remains evidence and never fills sender identity", async () => {
  const h = makeService({
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      ...baseIdentity(document, {}),
      association: undefined,
      selectedCustomerObservation: { status: "SELECTED", platformCustomerId: { value: "selected-customer" } },
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const result = h.service.handleTrustedInboundIngress(sender, context, { payload: { content: "hello", from: { role: "user" }, to: { role: "mall_cs" }, msg_id: "m1" } });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.identityLock.platformCustomerId.status, "UNKNOWN");
  assert.deepEqual(result.envelope.identityLock.runtimeEvidence?.selectedCustomerObservation, { status: "SELECTED", platformCustomerId: { value: "selected-customer" } });
});

test("resolver mutation of frozen source facts cannot change output and fails explicitly", async () => {
  const h = makeService({
    resolveIdentity: (message: { content: string }, document: { shopId: string }) => {
      (message as { content: string }).content = "tampered";
      return baseIdentity(document, { customerUid: "6318084722818", platformMessageId: "pdd-message-1" });
    },
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() });
  assert.equal(result.status, "FAILED");
  assert.equal(result.reason, "IDENTITY_BINDING_RESOLVER_THREW");
  assert.equal(h.collected.length, 0);
});

test("malformed outer input and malformed resolver binding return clear failures", async () => {
  const h = makeService({
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      ...baseIdentity(document, { customerUid: "6318084722818", platformMessageId: "pdd-message-1" }),
      scope: { merchantId: undefined, storeId: resolution("store-1"), platformAccountId: resolution("account-1") },
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  assert.deepEqual(h.service.handleTrustedInboundIngress(sender, context, null), { status: "REJECTED", reason: "MALFORMED_INGRESS_INPUT", diagnostics: [] });
  assert.equal(h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() }).reason, "MALFORMED_IDENTITY_BINDING");
  assert.equal(h.collected.length, 0);
});

test("canonical validator unavailable, false, or throwing fails closed without collector or downstream calls", async () => {
  for (const [canonicalValidator, reason] of [
    [null, "CANONICAL_VALIDATOR_UNAVAILABLE"],
    [() => false, "CANONICAL_VALIDATION_FAILED"],
    [() => { throw new Error("validator boom"); }, "CANONICAL_VALIDATOR_THREW"],
  ] as const) {
    const h = makeService({ canonicalValidator });
    await h.service.activate("shop-a");
    h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
    const sender = h.service.webContentsFor("shop-a")!;
    const context = h.service.createInboundIngressContext(sender)!;
    const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() });
    assert.equal(result.status, "FAILED");
    assert.equal(result.reason, reason);
    assert.equal(h.collected.length, 0);
    assert.equal(h.calls.ai, 0);
    assert.equal(h.calls.legacyInbound, 0);
  }
});

test("collector missing, synchronous throw, and async return stop without MAPPED", async () => {
  const missing = makeService({ collector: null });
  await missing.service.activate("shop-a");
  missing.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const missingSender = missing.service.webContentsFor("shop-a")!;
  const missingContext = missing.service.createInboundIngressContext(missingSender)!;
  assert.deepEqual(missing.service.handleTrustedInboundIngress(missingSender, missingContext, { payload: validPayload() }).status, "STOPPED");

  const throwing = makeService({ collector: () => { throw new Error("sync collector"); } });
  await throwing.service.activate("shop-a");
  throwing.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const throwingSender = throwing.service.webContentsFor("shop-a")!;
  const throwingContext = throwing.service.createInboundIngressContext(throwingSender)!;
  const throwingResult = throwing.service.handleTrustedInboundIngress(throwingSender, throwingContext, { payload: validPayload() });
  assert.equal(throwingResult.status, "FAILED");
  assert.equal(throwingResult.reason, "COLLECTOR_THREW");

  const asyncResult = makeService({ collector: () => Promise.reject(new Error("async collector")) });
  await asyncResult.service.activate("shop-a");
  asyncResult.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const asyncSender = asyncResult.service.webContentsFor("shop-a")!;
  const asyncContext = asyncResult.service.createInboundIngressContext(asyncSender)!;
  const result = asyncResult.service.handleTrustedInboundIngress(asyncSender, asyncContext, { payload: validPayload() });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(result.status, "FAILED");
  assert.equal(result.reason, "ASYNC_COLLECTOR_UNSUPPORTED");
});

test("source time valid/missing/invalid branches keep source and observed semantics separate", async () => {
  const h = await makeReady("shop-a");
  const valid = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-09-17T12:00:00.123Z" });
  const missing = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: null });
  const invalid = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-02-30T12:00:00" });
  const missingZone = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-09-17T12:00:00" });
  const trailingGarbage = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-09-17T12:00:00Zjunk" });
  const illegalCalendar = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-02-30T12:00:00Z" });
  assert.equal(valid.status, "MAPPED");
  assert.equal(missing.status, "MAPPED");
  assert.equal(invalid.status, "MAPPED");
  assert.equal(missingZone.status, "MAPPED");
  assert.equal(trailingGarbage.status, "MAPPED");
  assert.equal(illegalCalendar.status, "MAPPED");
  if (valid.status === "MAPPED") assert.equal(valid.envelope.sourceOccurredAt, "2026-09-17T12:00:00.123Z");
  if (missing.status === "MAPPED") assert.equal(missing.envelope.sourceOccurredAt, null);
  if (invalid.status === "MAPPED") assert.equal(invalid.envelope.sourceOccurredAt, null);
  for (const result of [invalid, missingZone, trailingGarbage, illegalCalendar]) { if (result.status === "MAPPED") { assert.equal(result.envelope.sourceOccurredAt, null); assert.ok(result.diagnostics.includes("SOURCE_TIME_INVALID")); } }
});

test("cross-shop association reuse is rejected while correct A/B associations map", async () => {
  const scopeA = { merchantId: resolution("merchant-a"), storeId: resolution("store-a"), platformAccountId: resolution("account-a") };
  const scopeB = { merchantId: resolution("merchant-b"), storeId: resolution("store-b"), platformAccountId: resolution("account-b") };
  const assocA = { ownerRuntimeShopId: "shop-a", ownerScope: scopeA, platformCustomerId: "1001", platformMessageId: "same", internalConversationId: resolution("conversation-a"), localMessageId: resolution("local-message-a") };
  const assocB = { ownerRuntimeShopId: "shop-b", ownerScope: scopeB, platformCustomerId: "1001", platformMessageId: "same", internalConversationId: resolution("conversation-b"), localMessageId: resolution("local-message-b") };
  let reuseAForB = false;
  const h = makeService({
    resolveScope: (document: { shopId: string }) => document.shopId === "shop-a" ? scopeA : scopeB,
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: document.shopId === "shop-a" ? scopeA : scopeB,
      runtimeConversationReference: resolution({ value: "runtime-" + document.shopId }),
      association: document.shopId === "shop-b" && reuseAForB ? assocA : document.shopId === "shop-a" ? assocA : assocB,
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const senderA = h.service.webContentsFor("shop-a")!;
  const contextA = h.service.createInboundIngressContext(senderA)!;
  await h.service.activate("shop-b");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-b", shop_id: "shop-b" } as never);
  const senderB = h.service.webContentsFor("shop-b")!;
  const contextB = h.service.createInboundIngressContext(senderB)!;
  const samePayload = validPayload({ content: "same", from: { role: "user", uid: "1001" }, msg_id: "same" });
  const correctA = h.service.handleTrustedInboundIngress(senderA, contextA, { payload: samePayload });
  const correctB = h.service.handleTrustedInboundIngress(senderB, contextB, { payload: samePayload });
  reuseAForB = true;
  const reused = h.service.handleTrustedInboundIngress(senderB, contextB, { payload: samePayload });
  assert.equal(correctA.status, "MAPPED");
  assert.equal(correctB.status, "MAPPED");
  assert.equal(reused.status, "REJECTED");
  assert.equal(reused.reason, "ASSOCIATION_RUNTIME_SHOP_MISMATCH");
  assert.equal(h.collected.length, 2);
});

test("same customer with a different message cannot reuse a local-message association", async () => {
  const h = makeService({
    resolveIdentity: (_message: unknown, document: { shopId: string }) => ({
      runtimeShop: resolution({ value: document.shopId }),
      scope: defaultScope(),
      runtimeConversationReference: resolution({ value: "runtime-" + document.shopId }),
      association: {
        ownerRuntimeShopId: document.shopId,
        ownerScope: defaultScope(),
        platformCustomerId: "1001",
        platformMessageId: "m-a",
        internalConversationId: resolution("conversation-a"),
        localMessageId: resolution("local-message-a"),
      },
    }),
  });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload({ from: { role: "user", uid: "1001" }, msg_id: "m-b" }) });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, "MESSAGE_ASSOCIATION_MISMATCH");
  assert.equal(h.collected.length, 0);
});

test("content cannot select identity: same content with different identity and different content with same identity", async () => {
  const h = await makeReady("shop-a");
  const sameContentA = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "same-content", from: { role: "user", uid: "1001" }, msg_id: "m-a" }) });
  const sameContentB = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "same-content", from: { role: "user", uid: "1002" }, msg_id: "m-b" }) });
  const changedContentA = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "changed-content", from: { role: "user", uid: "1001" }, msg_id: "m-a" }) });
  assert.equal(sameContentA.status, "MAPPED");
  assert.equal(sameContentB.status, "MAPPED");
  assert.equal(changedContentA.status, "MAPPED");
  if (sameContentA.status === "MAPPED" && sameContentB.status === "MAPPED" && changedContentA.status === "MAPPED") {
    assert.notEqual(sameContentA.envelope.identityLock.internalConversationId.value, sameContentB.envelope.identityLock.internalConversationId.value);
    assert.equal(changedContentA.envelope.identityLock.internalConversationId.value, sameContentA.envelope.identityLock.internalConversationId.value);
  }
});

test("source content remains exact for whitespace and long text", async () => {
  const h = await makeReady("shop-a");
  const text = " " + "x".repeat(5000) + "\n";
  const result = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: text }) });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.sourceContent.text, text);
});