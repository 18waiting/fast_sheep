// Child-target coverage accounting: "discovered", "attached", "Network.enable succeeded" and "events
// actually arrived" are four separate facts. This file pins that separation, because a successful
// attach must never be read as proven coverage, and a quiet session must never be read as unlistened.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PddInboundObserver } from "../dist/main/platforms/pdd/pdd-inbound-observer.js";

class RecordingDebugger extends EventEmitter {
  attached = false;
  bodies = new Map();
  commands = [];
  attach() { this.attached = true; }
  detach() { this.attached = false; this.emit("detach", {}, "test-detach"); }
  isAttached() { return this.attached; }
  sendCommand(method, params, sessionId) {
    this.commands.push({ method, sessionId: sessionId ?? null, requestId: params && params.requestId ? params.requestId : null });
    if (method === "Network.getResponseBody") {
      const key = (sessionId ?? "") + "|" + (params && params.requestId ? params.requestId : "");
      const body = this.bodies.get(key);
      return body === undefined ? Promise.reject(new Error("No resource with given identifier")) : Promise.resolve(body);
    }
    return Promise.resolve({});
  }
}

class RecordingWebContents extends EventEmitter {
  debugger = new RecordingDebugger();
  isDestroyed() { return false; }
}

class FakeDebugger extends EventEmitter {
  attached = false;
  enableFailures = new Set();
  enableCalls = [];
  attach() { this.attached = true; }
  detach() { this.attached = false; this.emit("detach", {}, "test-detach"); }
  isAttached() { return this.attached; }
  sendCommand(method, params, sessionId) {
    if (method === "Network.enable") {
      this.enableCalls.push(sessionId ?? "<root>");
      if (sessionId && this.enableFailures.has(sessionId)) return Promise.reject(new Error("Not attached to target"));
    }
    return Promise.resolve({});
  }
}

class FakeWebContents extends EventEmitter {
  debugger = new FakeDebugger();
  isDestroyed() { return false; }
}

function makeObserver() {
  const webContents = new FakeWebContents();
  const binding = { sessionId: "session-1", shopId: "shop-1", documentGeneration: 1 };
  const observer = new PddInboundObserver({
    webContents: webContents as never,
    shopId: "shop-1",
    allowedUrl: () => false,
    getDocumentBinding: () => binding,
    onConnection: () => {},
    onFrame: () => {},
  });
  return { observer, webContents, debugger: webContents.debugger };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("discovery, attach, enable and received events are counted separately", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;

  let snapshot = h.observer.snapshot();
  assert.equal(snapshot.childCoverageTotals.discoveredTargets, 0, "no target is discovered before Target events arrive");

  // 1. discovery only
  h.debugger.emit("message", {}, "Target.targetCreated", { targetInfo: { targetId: "T-1", type: "worker", url: "http://127.0.0.1/worker.js" } }, "");
  snapshot = h.observer.snapshot();
  assert.equal(snapshot.childCoverageTotals.discoveredTargets, 1);
  assert.equal(snapshot.childCoverageTotals.attachedSessions, 0, "discovery alone is not an attachment");
  assert.equal(snapshot.childCoverageTotals.networkEnabled, 0, "discovery alone enables nothing");
  assert.equal(snapshot.discoveredTargets[0].pathname, "/worker.js");

  // 2. attach (enable is still pending until the promise resolves)
  h.debugger.emit("message", {}, "Target.attachedToTarget", { sessionId: "child-1", targetId: "T-1", targetInfo: { type: "worker", url: "http://127.0.0.1/worker.js" }, waitingForDebugger: false }, "");
  snapshot = h.observer.snapshot();
  assert.equal(snapshot.childCoverageTotals.attachedSessions, 1);
  assert.equal(snapshot.childCoverageTotals.networkEnablePending, 1, "attach does not prove Network.enable yet");
  assert.equal(snapshot.childCoverageTotals.networkEnabled, 0);
  assert.deepEqual(h.debugger.enableCalls, ["<root>", "child-1"], "Network.enable is sent to the child session");

  await settle();
  snapshot = h.observer.snapshot();
  assert.equal(snapshot.childCoverageTotals.networkEnabled, 1);
  assert.equal(snapshot.childCoverageTotals.networkEnablePending, 0);

  // 3. events on that session
  h.debugger.emit("message", {}, "Network.webSocketCreated", { requestId: "r-1", url: "ws://127.0.0.1/ws" }, "child-1");
  h.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "r-1", response: { opcode: 2, payloadData: "AAAA" } }, "child-1");
  h.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r-2", request: { url: "http://127.0.0.1/api", method: "GET" } }, "");
  snapshot = h.observer.snapshot();
  const child = snapshot.childCoverage[0];
  assert.equal(child.cdpSessionId, "child-1");
  assert.equal(child.networkEnableState, "ENABLED");
  assert.equal(child.events["Network.webSocketCreated"], 1);
  assert.equal(child.events["Network.webSocketFrameReceived"], 1);
  assert.equal(child.eventTotal, 3, "attach + two events on this session");
  assert.equal(snapshot.rootEventCounts["Network.requestWillBeSent"], 1, "root events are counted separately");
  assert.equal(snapshot.childCoverageTotals.childEventsReceived, 3);
});

test("a child session whose Network.enable fails is reported as not enabled, with a sanitized cause", async () => {
  const h = makeObserver();
  h.debugger.enableFailures.add("child-2");
  const handle = h.observer.start();
  await handle.enablePromise;
  h.debugger.emit("message", {}, "Target.attachedToTarget", { sessionId: "child-2", targetId: "T-2", targetInfo: { type: "worker", url: "http://127.0.0.1/worker2.js" } }, "");
  await settle();
  const snapshot = h.observer.snapshot();
  assert.equal(snapshot.childCoverageTotals.attachedSessions, 1);
  assert.equal(snapshot.childCoverageTotals.networkEnabled, 0);
  assert.equal(snapshot.childCoverageTotals.networkEnableFailed, 1);
  assert.equal(snapshot.childCoverage[0].networkEnableCause, "DEBUGGER_DETACHED", "cause is reduced to a sanitized code");
  assert.equal(snapshot.childCoverage[0].eventTotal, 1, "only the attach event was observed on this session");
});

test("detach and destroy are recorded, and events after detach are not counted", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.debugger.emit("message", {}, "Target.targetCreated", { targetInfo: { targetId: "T-3", type: "worker", url: "http://127.0.0.1/worker3.js" } }, "");
  h.debugger.emit("message", {}, "Target.attachedToTarget", { sessionId: "child-3", targetId: "T-3", targetInfo: { type: "worker", url: "http://127.0.0.1/worker3.js" } }, "");
  await settle();
  h.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "r-1", response: { opcode: 2, payloadData: "AAAA" } }, "child-3");
  const before = h.observer.snapshot().childCoverageTotals.childEventsReceived;

  h.debugger.emit("message", {}, "Target.detachedFromTarget", { sessionId: "child-3" }, "");
  h.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "r-1", response: { opcode: 2, payloadData: "BBBB" } }, "child-3");
  const snapshot = h.observer.snapshot();
  assert.ok(snapshot.childCoverage[0].detachedAt, "detach time is recorded");
  assert.equal(snapshot.childCoverageTotals.childEventsReceived, before, "events after detach are not counted");

  h.debugger.emit("message", {}, "Target.targetDestroyed", { targetId: "T-3" }, "");
  assert.ok(h.observer.snapshot().discoveredTargets[0].destroyedAt, "destroy time is recorded");
});

test("two child sessions are accounted independently", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  for (const [sessionId, targetId] of [["child-a", "T-A"], ["child-b", "T-B"]]) {
    h.debugger.emit("message", {}, "Target.targetCreated", { targetInfo: { targetId, type: "worker", url: "http://127.0.0.1/same-worker.js" } }, "");
    h.debugger.emit("message", {}, "Target.attachedToTarget", { sessionId, targetId, targetInfo: { type: "worker", url: "http://127.0.0.1/same-worker.js" } }, "");
  }
  await settle();
  h.debugger.emit("message", {}, "Network.webSocketCreated", { requestId: "rk-1", url: "ws://127.0.0.1/ws" }, "child-a");
  h.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "rk-1", response: { opcode: 2, payloadData: "AAAA" } }, "child-a");
  const snapshot = h.observer.snapshot();
  const a = snapshot.childCoverage.find((entry) => entry.cdpSessionId === "child-a");
  const b = snapshot.childCoverage.find((entry) => entry.cdpSessionId === "child-b");
  assert.equal(a.eventTotal, 3);
  assert.equal(b.eventTotal, 1, "the other session only has its attach event");
  assert.equal(snapshot.childCoverageTotals.attachedSessions, 2);
  assert.equal(snapshot.childCoverageTotals.networkEnabled, 2);
  assert.equal(new Set(snapshot.childCoverage.map((entry) => entry.pathname)).size, 1, "same worker URL does not merge accounts by itself");
});

test("a child-session response body is read on the session that owns the request", async () => {
  const webContents = new RecordingWebContents();
  const responses = [];
  const observer = new PddInboundObserver({
    webContents: webContents as never,
    shopId: "shop-1",
    allowedUrl: () => false,
    allowedHttpRequest: (method, url) => method === "GET" && url === "http://127.0.0.1:1234/api/worker-data",
    getDocumentBinding: () => ({ sessionId: "session-1", shopId: "shop-1", documentGeneration: 1 }),
    onConnection: () => {},
    onFrame: () => {},
    onHttpResponse: (frame) => responses.push(frame),
  });
  webContents.debugger.bodies.set("child-9|r-child", { body: JSON.stringify({ ok: true, label: "FX-CHILD-1" }), base64Encoded: false });
  const handle = observer.start();
  await handle.enablePromise;
  webContents.debugger.emit("message", {}, "Target.attachedToTarget", { sessionId: "child-9", targetId: "T-9", targetInfo: { type: "worker", url: "http://127.0.0.1/worker.js" } }, "");
  await new Promise((resolve) => setTimeout(resolve, 0));
  webContents.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r-child", request: { url: "http://127.0.0.1:1234/api/worker-data", method: "GET" } }, "child-9");
  webContents.debugger.emit("message", {}, "Network.responseReceived", { requestId: "r-child", response: { status: 200, mimeType: "application/json" } }, "child-9");
  webContents.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "r-child" }, "child-9");
  await new Promise((resolve) => setTimeout(resolve, 20));

  const readCommand = webContents.debugger.commands.find((entry) => entry.method === "Network.getResponseBody" && entry.requestId === "r-child");
  assert.ok(readCommand, "a body read was attempted for the child-session request");
  assert.equal(readCommand.sessionId, "child-9", "the read must be issued on the owning session");
  assert.equal(responses.length, 1, "the body of a child-session request is emitted");
  assert.equal(responses[0].binding.connection.cdpSessionId, "child-9");
  assert.ok(responses[0].body.includes("FX-CHILD-1"));
  const snapshot = observer.snapshot();
  assert.equal(snapshot.httpBodyReadOk, 1);
  assert.deepEqual(snapshot.httpBodyReadStopped, {});
});

test("a root-session body read still omits the session argument", async () => {
  const webContents = new RecordingWebContents();
  const responses = [];
  const observer = new PddInboundObserver({
    webContents: webContents as never,
    shopId: "shop-1",
    allowedUrl: () => false,
    allowedHttpRequest: (method) => method === "GET",
    getDocumentBinding: () => ({ sessionId: "session-1", shopId: "shop-1", documentGeneration: 1 }),
    onConnection: () => {},
    onFrame: () => {},
    onHttpResponse: (frame) => responses.push(frame),
  });
  webContents.debugger.bodies.set("|r-root", { body: "{\"ok\":true}", base64Encoded: false });
  const handle = observer.start();
  await handle.enablePromise;
  webContents.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r-root", request: { url: "http://127.0.0.1:1234/api/data", method: "GET" } }, "");
  webContents.debugger.emit("message", {}, "Network.responseReceived", { requestId: "r-root", response: { status: 200, mimeType: "application/json" } }, "");
  webContents.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "r-root" }, "");
  await new Promise((resolve) => setTimeout(resolve, 20));
  const readCommand = webContents.debugger.commands.find((entry) => entry.method === "Network.getResponseBody" && entry.requestId === "r-root");
  assert.ok(readCommand);
  assert.equal(readCommand.sessionId, null, "root-session reads keep the two-argument form");
  assert.equal(responses.length, 1);
});
