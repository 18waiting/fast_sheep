import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PddInboundObserver } from "../dist/main/platforms/pdd/pdd-inbound-observer.js";

class FakeDebugger extends EventEmitter {
  attached = false;
  attach() { this.attached = true; }
  detach() { this.attached = false; this.emit("detach", {}, "x"); }
  isAttached() { return this.attached; }
  sendCommand() { return Promise.resolve(); }
}
class FakeWebContents extends EventEmitter { debugger = new FakeDebugger(); isDestroyed() { return false; } }

function make() {
  const wc = new FakeWebContents();
  const frames = [];
  const observer = new PddInboundObserver({
    webContents: wc, shopId: "s1",
    allowedUrl: () => false, // canonical WS allowlist deliberately EMPTY for this test
    allowedHttpRequest: () => false,
    getDocumentBinding: () => ({ sessionId: "sess", shopId: "s1", documentGeneration: 1 }),
    onConnection: () => {}, onFrame: () => {}, onHttpResponse: () => {},
    onDiagnosticWsFrame: (f) => frames.push(f),
  });
  return { wc, observer, frames };
}

test("diagnostic WS observation binds origin and counts frames WITHOUT widening the canonical allowlist", async () => {
  const h = make();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.webSocketCreated", { requestId: "w1", url: "wss://m-ws.example.invalid/?access_token=SECRET" }, "");
  h.wc.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "w1", response: { opcode: 1, payloadData: "{\"a\":1}" } }, "");
  h.wc.debugger.emit("message", {}, "Network.webSocketFrameSent", { requestId: "w1", response: { opcode: 1, payloadData: "{\"b\":2}" } }, "");
  // an unbound frame (no observed creation) must not be attributed to any origin
  h.wc.debugger.emit("message", {}, "Network.webSocketFrameReceived", { requestId: "ghost", response: { opcode: 2, payloadData: "AA==" } }, "");

  const s = h.observer.snapshot();
  assert.equal(s.wsOrigins["wss://m-ws.example.invalid"], 1, "origin recorded without query");
  assert.equal(s.wsFramesIn["opcode:1"], 1);
  assert.equal(s.wsFramesOut["opcode:1"], 1);
  assert.equal(s.wsUnboundFrames, 1, "frames without trusted creation evidence are unbound");
  assert.equal(JSON.stringify(s).includes("SECRET"), false, "query/token never recorded");
  assert.equal(h.frames.length, 3, "diagnostic sink sees bound frames");
  // canonical path untouched: no canonical connection was admitted
  assert.equal(s.connectionCount, 0, "diagnostic binding never creates a canonical connection");
});