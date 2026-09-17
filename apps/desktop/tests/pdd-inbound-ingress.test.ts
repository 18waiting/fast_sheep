import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";

class FakeView {
  visible = false;
  disposed = false;
  webContents = {
    destroyed: false,
    send: () => {},
    isDestroyed: () => this.webContents.destroyed,
  };
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

function baseIdentity(document: { shopId: string }, message: { content: string }) {
  const conversation = message.content === "second" ? "conversation-2" : "conversation-1";
  return {
    runtimeShop: resolution({ value: document.shopId }),
    merchantId: resolution("merchant-1"),
    storeId: resolution("store-1"),
    platformAccountId: resolution("account-1"),
    internalConversationId: resolution(conversation),
    runtimeConversationReference: resolution({ value: "runtime-" + conversation }),
    localMessageId: { status: "UNKNOWN" },
  } as never;
}

function makeService(options: Record<string, unknown> = {}) {
  const collected: Array<Record<string, unknown>> = [];
  const calls = { ai: 0, human: 0, focus: 0 };
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
    resolveInboundIdentity: (message: { content: string }, document: { shopId: string }) =>
      options.resolveIdentity === undefined
        ? baseIdentity(document, message)
        : (options.resolveIdentity as (message: { content: string }, document: { shopId: string }) => unknown)(message, document),
    onCanonicalInbound: options.collector === null
      ? undefined
      : ((options.collector as ((envelope: unknown) => void) | undefined) ?? ((envelope: unknown) => { collected.push(envelope as Record<string, unknown>); })),
    canonicalEnvelopeValidator: options.canonicalValidator as never,
    ...(options.serviceOverrides as Record<string, unknown> | undefined ?? {}),
  });
  return { service, collected, calls, views };
}

async function makeReady(shopId = "shop-1") {
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

test("valid fixture ingress maps through the real service, host, mapper, and schema validator", async () => {
  const h = await makeReady();
  const result = h.service.handleTrustedInboundIngress(h.sender, h.context, {
    payload: validPayload(),
    sourceOccurredAt: "2026-09-17T12:00:00Z",
  });
  assert.equal(result.status, "MAPPED");
  assert.equal(h.collected.length, 1);
  assert.equal((h.collected[0] as { sourceContent: { text: string } }).sourceContent.text, "  请问什么时候发货？\n");
  assert.equal((h.collected[0] as { sourceOccurredAt: string }).sourceOccurredAt, "2026-09-17T12:00:00Z");
  assert.equal(h.calls.ai, 0);
  assert.equal(h.calls.human, 0);
});

test("missing UID and msg_id map to explicit UNKNOWN rather than rejecting trusted input", async () => {
  const h = await makeReady();
  const result = h.service.handleTrustedInboundIngress(h.sender, h.context, {
    payload: { content: "hello", from: { role: "user" }, to: { role: "mall_cs" } },
    sourceOccurredAt: null,
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.identityLock.platformCustomerId.status, "UNKNOWN");
  assert.equal(result.envelope.identityLock.triggerMessage.platformMessageIdentity.provenance, "UNKNOWN");
  assert.ok(h.collected.length === 1);
});

test("present-but-invalid identity facts are rejected before output", async () => {
  const h = await makeReady();
  const invalidUid = h.service.handleTrustedInboundIngress(h.sender, h.context, {
    payload: validPayload({ from: { role: "user", uid: "buyer-1" } }),
  });
  const invalidMsg = h.service.handleTrustedInboundIngress(h.sender, h.context, {
    payload: validPayload({ msg_id: " " }),
  });
  assert.equal(invalidUid.status, "REJECTED");
  assert.equal(invalidMsg.status, "REJECTED");
  assert.equal(h.collected.length, 0);
});

test("wrong shop, wrong session, missing context, and stale document context are rejected", async () => {
  const a = await makeReady("shop-a");
  await a.service.activate("shop-b");
  a.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-b", shop_id: "shop-b" } as never);
  const senderB = a.service.webContentsFor("shop-b")!;
  const wrongShop = a.service.handleTrustedInboundIngress(senderB, a.context, { payload: validPayload() });
  assert.equal(wrongShop.status, "REJECTED");
  assert.equal(wrongShop.reason, "INVALID_DOCUMENT_CONTEXT");

  const missing = a.service.handleTrustedInboundIngress(a.sender, {}, { payload: validPayload() });
  assert.equal(missing.status, "REJECTED");
  assert.equal(missing.reason, "INVALID_DOCUMENT_CONTEXT");

  await a.service.reload("shop-a");
  a.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const stale = a.service.handleTrustedInboundIngress(a.sender, a.context, { payload: validPayload() });
  assert.equal(stale.status, "REJECTED");
  assert.equal(stale.reason, "INVALID_DOCUMENT_CONTEXT");
  assert.equal(a.collected.length, 0);
});

test("dispose and recreate invalidates an old context even with identical labels", async () => {
  const h = await makeReady("shop-a");
  const oldContext = h.context;
  const oldSender = h.sender;
  h.service.disposeAll();
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const newSender = h.service.webContentsFor("shop-a")!;
  const stale = h.service.handleTrustedInboundIngress(newSender, oldContext, { payload: validPayload() });
  assert.equal(stale.status, "REJECTED");
  assert.equal(stale.reason, "INVALID_DOCUMENT_CONTEXT");
  const untrusted = h.service.handleTrustedInboundIngress(oldSender, oldContext, { payload: validPayload() });
  assert.equal(untrusted.status, "REJECTED");
});

test("same message ID in different conversations reaches canonical output twice", async () => {
  const h = await makeReady("shop-a");
  const first = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "first", msg_id: "same-id" }) });
  const second = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload({ content: "second", msg_id: "same-id" }) });
  assert.equal(first.status, "MAPPED");
  assert.equal(second.status, "MAPPED");
  assert.equal(h.collected.length, 2);
});

test("selected customer observation never replaces the message sender identity", async () => {
  const selected = makeService({
    resolveIdentity: (_message: { content: string }, document: { shopId: string }) => ({
      ...baseIdentity(document, { content: "first" }),
      selectedCustomerObservation: { status: "SELECTED", platformCustomerId: { value: "selected-customer" } },
    }),
  });
  await selected.service.activate("shop-a");
  selected.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = selected.service.webContentsFor("shop-a")!;
  const context = selected.service.createInboundIngressContext(sender)!;
  const result = selected.service.handleTrustedInboundIngress(sender, context, {
    payload: { content: "hello", from: { role: "user" }, to: { role: "mall_cs" }, msg_id: "m1" },
  });
  assert.equal(result.status, "MAPPED");
  if (result.status !== "MAPPED") return;
  assert.equal(result.envelope.identityLock.platformCustomerId.status, "UNKNOWN");
  assert.deepEqual(result.envelope.identityLock.runtimeEvidence?.selectedCustomerObservation, {
    status: "SELECTED",
    platformCustomerId: { value: "selected-customer" },
  });
});

test("source time distinguishes valid, missing, and invalid values without fallback", async () => {
  const h = await makeReady("shop-a");
  const valid = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-09-17T12:00:00.123Z" });
  const missing = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: null });
  const invalid = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt: "2026-02-30T12:00:00" });
  assert.equal(valid.status, "MAPPED");
  assert.equal(missing.status, "MAPPED");
  assert.equal(invalid.status, "MAPPED");
  if (valid.status === "MAPPED") assert.equal(valid.envelope.sourceOccurredAt, "2026-09-17T12:00:00.123Z");
  if (missing.status === "MAPPED") assert.equal(missing.envelope.sourceOccurredAt, null);
  if (invalid.status === "MAPPED") assert.equal(invalid.envelope.sourceOccurredAt, null);
  if (invalid.status === "MAPPED") assert.ok(invalid.diagnostics.includes("SOURCE_TIME_INVALID"));
});

test("canonical validator unavailable, false, or throwing fails closed", async () => {
  for (const [validator, reason] of [
    [null, "CANONICAL_VALIDATOR_UNAVAILABLE"],
    [() => false, "CANONICAL_VALIDATION_FAILED"],
    [() => { throw new Error("boom"); }, "CANONICAL_VALIDATOR_THREW"],
  ] as const) {
    const h = makeService({ canonicalValidator: validator });
    await h.service.activate("shop-a");
    h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
    const sender = h.service.webContentsFor("shop-a")!;
    const context = h.service.createInboundIngressContext(sender)!;
    const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() });
    assert.equal(result.status, "FAILED");
    assert.equal(result.reason, reason);
    assert.equal(h.collected.length, 0);
  }
});

test("missing or throwing collector stops without falling back to legacy AI bridge", async () => {
  const missing = makeService({ collector: null });
  await missing.service.activate("shop-a");
  missing.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const missingSender = missing.service.webContentsFor("shop-a")!;
  const missingContext = missing.service.createInboundIngressContext(missingSender)!;
  const missingResult = missing.service.handleTrustedInboundIngress(missingSender, missingContext, { payload: validPayload() });
  assert.equal(missingResult.status, "STOPPED");
  assert.equal(missingResult.reason, "COLLECTOR_MISSING");
  assert.equal(missing.calls.ai, 0);

  const throwing = makeService({ collector: () => { throw new Error("collector"); } });
  await throwing.service.activate("shop-a");
  throwing.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const throwingSender = throwing.service.webContentsFor("shop-a")!;
  const throwingContext = throwing.service.createInboundIngressContext(throwingSender)!;
  const throwingResult = throwing.service.handleTrustedInboundIngress(throwingSender, throwingContext, { payload: validPayload() });
  assert.equal(throwingResult.status, "FAILED");
  assert.equal(throwingResult.reason, "COLLECTOR_THREW");
  assert.equal(throwing.calls.ai, 0);
});

test("two shops using equal customer/message identifiers remain isolated", async () => {
  const a = await makeReady("shop-a");
  const b = await makeReady("shop-b");
  const resultA = a.service.handleTrustedInboundIngress(a.sender, a.context, { payload: validPayload({ content: "same", msg_id: "same", from: { role: "user", uid: "1" } }) });
  const resultB = b.service.handleTrustedInboundIngress(b.sender, b.context, { payload: validPayload({ content: "same", msg_id: "same", from: { role: "user", uid: "1" } }) });
  assert.equal(resultA.status, "MAPPED");
  assert.equal(resultB.status, "MAPPED");
  assert.equal(a.collected.length, 1);
  assert.equal(b.collected.length, 1);
  assert.equal((a.collected[0] as { identityLock: { runtimeShop: { value: { value: string } } } }).identityLock.runtimeShop.value.value, "shop-a");
  assert.equal((b.collected[0] as { identityLock: { runtimeShop: { value: { value: string } } } }).identityLock.runtimeShop.value.value, "shop-b");
});


test("missing trusted identity binding rejects a conflicting canonical relationship", async () => {
  const h = makeService({ resolveIdentity: () => null });
  await h.service.activate("shop-a");
  h.service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a", shop_id: "shop-a" } as never);
  const sender = h.service.webContentsFor("shop-a")!;
  const context = h.service.createInboundIngressContext(sender)!;
  const result = h.service.handleTrustedInboundIngress(sender, context, { payload: validPayload() });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, "IDENTITY_BINDING_MISSING");
  assert.equal(h.collected.length, 0);
});

test("source time rejects missing timezone and trailing garbage as invalid", async () => {
  const h = await makeReady("shop-a");
  for (const sourceOccurredAt of ["2026-09-17T12:00:00", "2026-09-17T12:00:00Zjunk", "2026-13-01T12:00:00Z"]) {
    const result = h.service.handleTrustedInboundIngress(h.sender, h.context, { payload: validPayload(), sourceOccurredAt });
    assert.equal(result.status, "MAPPED");
    if (result.status !== "MAPPED") continue;
    assert.equal(result.envelope.sourceOccurredAt, null);
    assert.ok(result.diagnostics.includes("SOURCE_TIME_INVALID"));
  }
});
