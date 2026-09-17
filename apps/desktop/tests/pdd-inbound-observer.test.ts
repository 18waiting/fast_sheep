import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PddInboundObserver } from "../dist/main/platforms/pdd/pdd-inbound-observer.js";

class FakeDebugger extends EventEmitter {
  attached = false;
  attachCalls = 0;
  sendCommandCalls = 0;
  attach() { this.attachCalls += 1; this.attached = true; }
  detach() { this.attached = false; this.emit("detach", {}, "test-detach"); }
  isAttached() { return this.attached; }
  sendCommand() { this.sendCommandCalls += 1; return Promise.resolve(); }
}

class FakeWebContents extends EventEmitter {
  debugger = new FakeDebugger();
  destroyed = false;
  isDestroyed() { return this.destroyed; }
}

function makeObserver() {
  const webContents = new FakeWebContents();
  const connections = [];
  const frames = [];
  const stopped = [];
  const binding = { sessionId: "session-1", shopId: "shop-1", documentGeneration: 1 };
  const observer = new PddInboundObserver({
    webContents: webContents as never,
    shopId: "shop-1",
    allowedUrl: (url) => url.startsWith("ws://127.0.0.1/"),
    getDocumentBinding: () => binding,
    onConnection: (connection) => connections.push(connection),
    onFrame: (frame) => frames.push(frame),
    onStopped: (reason) => stopped.push(reason),
  });
  return { observer, webContents, connections, frames, stopped };
}

test("observer binds connection before frames and passes only the frozen connection route", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.webContents.debugger.emit("message", {}, "Network.webSocketCreated", { requestId: "request-1", url: "ws://127.0.0.1/socket" }, "");
  assert.equal(h.connections.length, 1);
  assert.equal(h.connections[0].webContents, h.webContents);
  h.webContents.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "request-1", response: { opcode: 1, payloadData: "hello" } }, "");
  assert.equal(h.frames.length, 1);
  assert.equal(h.frames[0].payloadData, "hello");
  assert.equal(h.frames[0].connection.requestId, "request-1");
});

test("unobserved, unauthorized, and pre-enable frames never reach the observer callback", async () => {
  const h = makeObserver();
  h.webContents.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "missing", response: { opcode: 1, payloadData: "pre" } }, "");
  const handle = h.observer.start();
  h.webContents.debugger.emit("message", {}, "Network.webSocketCreated", { requestId: "request-1", url: "ws://127.0.0.1/socket" }, "unauthorized");
  await handle.enablePromise;
  h.webContents.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "missing", response: { opcode: 1, payloadData: "missing" } }, "");
  assert.equal(h.connections.length, 0);
  assert.equal(h.frames.length, 0);
});

test("main document replacement and external detach terminate the lifecycle idempotently", async () => {
  const replacement = makeObserver();
  const handle = replacement.observer.start();
  await handle.enablePromise;
  replacement.webContents.emit("did-start-navigation", {}, "http://first", false, true);
  assert.equal(replacement.observer.isTerminal, false);
  replacement.webContents.emit("did-start-navigation", {}, "http://replacement", false, true);
  assert.equal(replacement.observer.isTerminal, true);
  const stopCount = replacement.stopped.length;
  replacement.observer.stop("again");
  assert.equal(replacement.stopped.length, stopCount);

  const detached = makeObserver();
  const detachedHandle = detached.observer.start();
  await detachedHandle.enablePromise;
  detached.webContents.debugger.emit("detach", {}, "external");
  assert.equal(detached.observer.isTerminal, true);
  assert.equal(detached.stopped.length, 1);
});

test("Network.enable failure terminates the lifecycle and cannot be revived", async () => {
  const h = makeObserver();
  h.webContents.debugger.sendCommand = () => Promise.reject(new Error("enable-failed"));
  const handle = h.observer.start();
  await assert.rejects(handle.enablePromise, /enable-failed/);
  assert.equal(h.observer.isTerminal, true);
  assert.equal(h.stopped.length, 1);
  h.webContents.debugger.emit("message", {}, "Network.webSocketCreated", { requestId: "late", url: "ws://127.0.0.1/socket" }, "");
  assert.equal(h.connections.length, 0);
});

test("detach while Network.enable is pending leaves the observer terminal", async () => {
  const h = makeObserver();
  let resolveEnable;
  h.webContents.debugger.sendCommand = () => new Promise((resolve) => { resolveEnable = resolve; });
  const handle = h.observer.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  h.webContents.debugger.emit("detach", {}, "pending-detach");
  resolveEnable();
  await handle.enablePromise;
  assert.equal(h.observer.isTerminal, true);
  assert.equal(h.stopped.length, 1);
});

test("Debugger.attach failure prevents a lifecycle from starting", () => {
  const h = makeObserver();
  h.webContents.debugger.attach = () => { throw new Error("attach-failed"); };
  assert.throws(() => h.observer.start(), /attach-failed/);
  assert.equal(h.observer.isTerminal, false);
  assert.equal(h.connections.length, 0);
});
