import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { BoundaryObserver } from "./observer.mjs";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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

function makeObserver() {
  const webContents = new FakeWebContents();
  let contextCalls = 0;
  const observer = new BoundaryObserver({
    webContents,
    shopId: "shop-a",
    allowedUrl: (url) => url.startsWith("ws://127.0.0.1/"),
    getService: () => ({
      createInboundIngressContext: () => { contextCalls += 1; return { token: {} }; },
      handleTrustedInboundIngress: () => ({ status: "MAPPED", envelope: { ok: true } }),
    }),
  });
  return { observer, webContents, contextCalls: () => contextCalls };
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

test("old enable completion cannot mutate a replacement lifecycle", async () => {
  const { observer, webContents } = makeObserver();
  let resolveOld;
  webContents.debugger.sendCommandResult = new Promise((resolve) => { resolveOld = resolve; });
  observer.start({ waitForLoad: false });
  await tick();
  await observer.detach();
  webContents.debugger.sendCommandResult = Promise.resolve();
  observer.start({ waitForLoad: false });
  await observer.ready;
  const readyLifecycle = observer.snapshot().lifecycle;
  resolveOld();
  await tick();
  assert.equal(observer.snapshot().enabled, true);
  assert.equal(observer.snapshot().lifecycle, readyLifecycle);
  assert.equal(observer.snapshot().readyStatus, "READY");
});

test("same-document and subframe navigation do not invalidate main document", async () => {
  const { observer, webContents } = makeObserver();
  observer.start({ waitForLoad: false });
  await observer.ready;
  const before = observer.snapshot();
  observer.navigationHandler({}, "#fragment", true, true);
  observer.navigationHandler({}, "https://frame.invalid", false, false);
  const after = observer.snapshot();
  assert.equal(after.terminal, false);
  assert.equal(after.lifecycle, before.lifecycle);
  assert.equal(after.enabled, true);
  void webContents;
});

test("main document replacement permanently stops the old observer", async () => {
  const { observer, contextCalls } = makeObserver();
  observer.start({ waitForLoad: false });
  await observer.ready;
  observer.navigationHandler({}, "https://new-document.invalid", false, true);
  const rawEvent = observer.deliverRawConnectionCreatedThroughCurrentListener({ requestId: "old-request", url: "ws://127.0.0.1/old" });
  assert.equal(rawEvent.status, "STOPPED");
  assert.equal(rawEvent.reason, "OBSERVER_TERMINAL");
  assert.equal(contextCalls(), 0);
  assert.equal(observer.snapshot().terminal, true);
  assert.equal(observer.snapshot().enabled, false);
});

test("external detach removes listeners and stops the lifecycle", async () => {
  const { observer, webContents } = makeObserver();
  observer.start({ waitForLoad: false });
  await observer.ready;
  webContents.debugger.detach();
  await tick();
  const snapshot = observer.snapshot();
  assert.equal(snapshot.terminal, true);
  assert.equal(snapshot.messageListenerCount, 0);
  assert.equal(snapshot.navigationListenerRegistered, false);
});

test("detach is idempotent across scheduled and enabled lifecycle states", async () => {
  const scheduled = makeObserver();
  scheduled.observer.start({ waitForLoad: true });
  await scheduled.observer.detach();
  const scheduledLifecycle = scheduled.observer.snapshot().lifecycle;
  await scheduled.observer.detach();
  assert.equal(scheduled.observer.snapshot().lifecycle, scheduledLifecycle);
  assert.equal(scheduled.webContents.debugger.attachCalls, 0);

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

test("attach failure cleans up and settles the lifecycle", async () => {
  const { observer, webContents } = makeObserver();
  webContents.debugger.attach = () => { throw new Error("fixture-attach-failure"); };
  observer.start({ waitForLoad: false });
  const ready = await observer.ready;
  assert.equal(ready.status, "FAILED");
  assert.equal(observer.snapshot().terminal, true);
  assert.equal(observer.snapshot().enabled, false);
  assert.equal(observer.snapshot().messageListenerCount, 0);
  assert.equal(observer.snapshot().navigationListenerRegistered, false);
});

test("Network.enable failure cleans up and settles the lifecycle", async () => {
  const { observer, webContents } = makeObserver();
  webContents.debugger.sendCommand = () => Promise.reject(new Error("fixture-enable-failure"));
  observer.start({ waitForLoad: false });
  const ready = await observer.ready;
  assert.equal(ready.status, "FAILED");
  assert.equal(observer.snapshot().terminal, true);
  assert.equal(observer.snapshot().enabled, false);
  assert.equal(observer.snapshot().messageListenerCount, 0);
  assert.equal(observer.snapshot().navigationListenerRegistered, false);
});

test("same-WebContents reattach is refused after main-document replacement", async () => {
  const { observer, contextCalls } = makeObserver();
  observer.start({ waitForLoad: false });
  await observer.ready;
  observer.navigationHandler({}, "https://new-document.invalid", false, true);
  const result = await observer.reattach();
  assert.equal(result.status, "STOPPED");
  assert.equal(result.reason, "SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED");
  assert.equal(contextCalls(), 0);
  assert.equal(observer.snapshot().terminal, true);
});
