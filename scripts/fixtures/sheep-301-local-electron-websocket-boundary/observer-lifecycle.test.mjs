import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { BoundaryObserver } from "./observer.mjs";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const validFrame = { opcode: 1, payloadData: JSON.stringify({ kind: "proof-frame", payload: { content: "old-valid-text" } }) };

class FakeDebugger extends EventEmitter {
  attached = false;
  attachCalls = 0;
  detachCalls = 0;
  sendCommandCalls = 0;
  sendCommandResult = Promise.resolve();
  attach() { this.attachCalls += 1; this.attached = true; }
  detach() { this.detachCalls += 1; this.attached = false; this.emit("detach", {}, "test-detach"); }
  isAttached() { return this.attached; }
  sendCommand() { this.sendCommandCalls += 1; return this.sendCommandResult; }
}

class FakeWebContents extends EventEmitter {
  constructor(id = 1) { super(); this.id = id; this.debugger = new FakeDebugger(); }
}

function makeObserver(existingWebContents) {
  const webContents = existingWebContents ?? new FakeWebContents();
  const counts = { context: 0, ingress: 0, collector: 0 };
  const observer = new BoundaryObserver({
    webContents,
    shopId: "shop-a",
    allowedUrl: (url) => url.startsWith("ws://127.0.0.1/"),
    getService: () => ({
      createInboundIngressContext: () => { counts.context += 1; return { token: {} }; },
      handleTrustedInboundIngress: () => { counts.ingress += 1; counts.collector += 1; return { status: "MAPPED", envelope: { ok: true } }; },
    }),
  });
  return { observer, webContents, contextCalls: () => counts.context, ingressCalls: () => counts.ingress, collectorCalls: () => counts.collector };
}

test("start then detach prevents delayed did-finish-load attach", async () => {
  const { observer, webContents } = makeObserver();
  observer.start({ waitForLoad: true });
  await observer.detach();
  webContents.emit("did-finish-load");
  await tick();
  assert.equal(webContents.debugger.attachCalls, 0);
  assert.equal(observer.snapshot().attachScheduled, false);
  assert.equal(observer.snapshot().readyStatus, "CANCELLED");
});

test("pending Network.enable cannot revive a detached lifecycle", async () => {
  const { observer, webContents } = makeObserver();
  let resolveEnable;
  webContents.debugger.sendCommandResult = new Promise((resolve) => { resolveEnable = resolve; });
  observer.start({ waitForLoad: false });
  await tick();
  await observer.detach();
  resolveEnable();
  await tick();
  assert.equal(observer.snapshot().enabled, false);
  assert.equal(observer.snapshot().readyStatus, "CANCELLED");
});

test("old enable completion cannot mutate a replacement WebContents lifecycle", async () => {
  const old = makeObserver();
  let resolveOld;
  old.webContents.debugger.sendCommandResult = new Promise((resolve) => { resolveOld = resolve; });
  old.observer.start({ waitForLoad: false });
  await tick();
  await old.observer.detach();

  const replacement = makeObserver();
  replacement.observer.start({ waitForLoad: false });
  await replacement.observer.ready;
  const readyLifecycle = replacement.observer.snapshot().lifecycle;
  resolveOld();
  await tick();
  assert.equal(replacement.observer.snapshot().enabled, true);
  assert.equal(replacement.observer.snapshot().lifecycle, readyLifecycle);
  assert.equal(replacement.observer.snapshot().readyStatus, "READY");
  assert.equal((await old.observer.start({ waitForLoad: false })).status, "STOPPED");
});

test("same-document and subframe navigation do not invalidate main document", async () => {
  const { observer } = makeObserver();
  observer.start({ waitForLoad: false });
  await observer.ready;
  const before = observer.snapshot();
  observer.navigationHandler({}, "#fragment", true, true);
  observer.navigationHandler({}, "https://frame.invalid", false, false);
  const after = observer.snapshot();
  assert.equal(after.terminal, false);
  assert.equal(after.lifecycle, before.lifecycle);
  assert.equal(after.enabled, true);
});

test("termination rejects every same-WebContents activation and old event route", async () => {
  const h = makeObserver();
  h.observer.start({ waitForLoad: false });
  await h.observer.ready;
  const activeConnection = h.observer.deliverRawConnectionCreatedThroughCurrentListener({ requestId: "old-request", url: "ws://127.0.0.1/old" }, "");
  assert.equal(activeConnection.status, "ACCEPTED");
  const activeFrame = h.observer.injectFrameWithSession({ requestId: "old-request", response: validFrame }, "", h.observer.activeToken);
  assert.equal(activeFrame.result.status, "MAPPED");
  const oldFrameIndex = h.observer.capturedFrames.length - 1;
  const oldBinding = h.observer.bindings.get([...h.observer.bindings.keys()][0]);
  assert.ok(oldBinding);
  const before = { context: h.contextCalls(), ingress: h.ingressCalls(), collector: h.collectorCalls() };

  h.observer.navigationHandler({}, "https://replacement.invalid", false, true);
  assert.equal(h.observer.snapshot().terminal, true);

  const directStart = await h.observer.start({ waitForLoad: false });
  const reattach = await h.observer.reattach();
  const staleCallback = h.observer.replayCapturedConnectionCreated(oldBinding);
  const staleFrame = h.observer.replayCapturedFrame(oldFrameIndex);
  const rawOldEvent = h.observer.deliverRawConnectionCreatedThroughCurrentListener({ requestId: "late-old", url: "ws://127.0.0.1/late" }, "");
  const replacementObserver = makeObserver(h.webContents);
  const replacementStart = await replacementObserver.observer.start({ waitForLoad: false });

  for (const result of [directStart, reattach, replacementStart]) {
    assert.equal(result.status, "STOPPED");
    assert.equal(result.reason, "SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED");
  }
  assert.equal(staleCallback.status, "STOPPED");
  assert.equal(staleFrame.status, "STOPPED");
  assert.equal(rawOldEvent.status, "STOPPED");
  assert.equal(h.observer.snapshot().enabled, false);
  assert.equal(h.observer.snapshot().messageListenerCount, 0);
  assert.equal(h.observer.snapshot().navigationListenerRegistered, false);
  assert.equal(replacementObserver.observer.snapshot().messageListenerCount, 0);
  assert.equal(replacementObserver.observer.snapshot().navigationListenerRegistered, false);
  assert.equal(h.contextCalls(), before.context);
  assert.equal(h.ingressCalls(), before.ingress);
  assert.equal(h.collectorCalls(), before.collector);
  assert.equal(replacementObserver.contextCalls(), 0);
  assert.equal(replacementObserver.ingressCalls(), 0);
  assert.equal(replacementObserver.collectorCalls(), 0);
});

test("external detach then navigation rejects reattach and direct start", async () => {
  const h = makeObserver();
  h.observer.start({ waitForLoad: false });
  await h.observer.ready;
  h.webContents.debugger.detach();
  await tick();
  h.webContents.emit("did-start-navigation", {}, "https://replacement.invalid", false, true);
  await tick();
  const before = { context: h.contextCalls(), ingress: h.ingressCalls(), collector: h.collectorCalls() };
  const reattach = await h.observer.reattach();
  const directStart = await h.observer.start({ waitForLoad: false });
  const rawOldEvent = h.observer.deliverRawConnectionCreatedThroughCurrentListener({ requestId: "detached-old", url: "ws://127.0.0.1/old" }, "");
  assert.equal(reattach.status, "STOPPED");
  assert.equal(directStart.status, "STOPPED");
  assert.equal(rawOldEvent.status, "STOPPED");
  assert.equal(h.observer.snapshot().terminal, true);
  assert.equal(h.observer.snapshot().enabled, false);
  assert.equal(h.observer.snapshot().messageListenerCount, 0);
  assert.equal(h.observer.snapshot().navigationListenerRegistered, false);
  assert.equal(h.contextCalls(), before.context);
  assert.equal(h.ingressCalls(), before.ingress);
  assert.equal(h.collectorCalls(), before.collector);
});

test("detach is idempotent across scheduled and enabled lifecycle states", async () => {
  const scheduled = makeObserver();
  scheduled.observer.start({ waitForLoad: true });
  await scheduled.observer.detach();
  const scheduledLifecycle = scheduled.observer.snapshot().lifecycle;
  await scheduled.observer.detach();
  assert.equal(scheduled.observer.snapshot().lifecycle, scheduledLifecycle);
  assert.equal(scheduled.webContents.debugger.attachCalls, 0);
  assert.equal(scheduled.observer.snapshot().terminal, true);

  const enabled = makeObserver();
  enabled.observer.start({ waitForLoad: false });
  await enabled.observer.ready;
  const enabledLifecycle = enabled.observer.snapshot().lifecycle;
  await enabled.observer.detach();
  await enabled.observer.detach();
  assert.equal(enabled.observer.snapshot().lifecycle, enabledLifecycle + 1);
  assert.equal(enabled.observer.snapshot().terminal, true);
  assert.equal(enabled.observer.snapshot().messageListenerCount, 0);
});

test("attach failure cleans up and permanently terminates the WebContents", async () => {
  const { observer, webContents } = makeObserver();
  webContents.debugger.attach = () => { throw new Error("fixture-attach-failure"); };
  observer.start({ waitForLoad: false });
  const ready = await observer.ready;
  assert.equal(ready.status, "FAILED");
  assert.equal(observer.snapshot().terminal, true);
  assert.equal(observer.snapshot().enabled, false);
  assert.equal(observer.snapshot().messageListenerCount, 0);
  assert.equal(observer.snapshot().navigationListenerRegistered, false);
  assert.equal((await observer.start({ waitForLoad: false })).status, "STOPPED");
});

test("Network.enable failure cleans up and permanently terminates the WebContents", async () => {
  const { observer, webContents } = makeObserver();
  webContents.debugger.sendCommand = () => Promise.reject(new Error("fixture-enable-failure"));
  observer.start({ waitForLoad: false });
  const ready = await observer.ready;
  assert.equal(ready.status, "FAILED");
  assert.equal(observer.snapshot().terminal, true);
  assert.equal(observer.snapshot().enabled, false);
  assert.equal(observer.snapshot().messageListenerCount, 0);
  assert.equal(observer.snapshot().navigationListenerRegistered, false);
  assert.equal((await observer.start({ waitForLoad: false })).status, "STOPPED");
});

test("a new WebContents can establish an independent trusted lifecycle", async () => {
  const first = makeObserver();
  first.observer.start({ waitForLoad: false });
  await first.observer.ready;
  await first.observer.detach();
  assert.equal((await first.observer.start({ waitForLoad: false })).status, "STOPPED");

  const second = makeObserver();
  second.observer.start({ waitForLoad: false });
  await second.observer.ready;
  const raw = second.observer.deliverRawConnectionCreatedThroughCurrentListener({ requestId: "new-webcontents", url: "ws://127.0.0.1/new" }, "");
  assert.equal(raw.status, "ACCEPTED");
  const frame = second.observer.injectFrameWithSession({ requestId: "new-webcontents", response: validFrame }, "", second.observer.activeToken);
  assert.equal(frame.result.status, "MAPPED");
  assert.equal(second.contextCalls(), 1);
  assert.equal(second.ingressCalls(), 1);
  assert.equal(second.collectorCalls(), 1);
});
