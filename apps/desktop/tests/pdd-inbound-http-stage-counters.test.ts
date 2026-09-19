import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PddInboundObserver } from "../dist/main/platforms/pdd/pdd-inbound-observer.js";

class FakeDebugger extends EventEmitter {
  attached = false;
  bodies = new Map();
  attach() { this.attached = true; }
  detach() { this.attached = false; this.emit("detach", {}, "x"); }
  isAttached() { return this.attached; }
  sendCommand(method, params) {
    if (method === "Network.getResponseBody") {
      const b = this.bodies.get(params && params.requestId);
      return b === undefined ? Promise.reject(new Error("no body")) : Promise.resolve(b);
    }
    return Promise.resolve();
  }
}
class FakeWebContents extends EventEmitter { debugger = new FakeDebugger(); isDestroyed() { return false; } }

const URL_OK = "https://allowed.invalid/plateau/chat/latest_conversations";
function make() {
  const wc = new FakeWebContents();
  const out = [];
  const observer = new PddInboundObserver({
    webContents: wc, shopId: "s1", allowedUrl: () => true,
    allowedHttpRequest: (m, u) => m === "POST" && u === URL_OK,
    getDocumentBinding: () => ({ sessionId: "sess", shopId: "s1", documentGeneration: 1 }),
    onConnection: () => {}, onFrame: () => {},
    onHttpResponse: (f) => out.push(f),
  });
  return { wc, observer, out };
}

test("accepted request walks request -> response -> body-read and exposes sanitized stage counters", async () => {
  const h = make();
  h.wc.debugger.bodies.set("r1", { body: "{\"a\":1}", base64Encoded: false });
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r1", request: { url: URL_OK, method: "POST" } }, "");
  assert.equal(h.observer.snapshot().acceptedRequestIdCount, 1);
  h.wc.debugger.emit("message", {}, "Network.responseReceived", { requestId: "r1", response: { status: 200, mimeType: "application/json" } }, "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "r1" }, "");
  await new Promise((r) => setTimeout(r, 20));
  const s = h.observer.snapshot();
  assert.equal(s.httpAcceptedWithoutBinding, 0);
  assert.equal(s.httpResponseForBound, 1);
  assert.equal(s.httpLoadingFinishedForBound, 1);
  assert.equal(s.httpBodyReadAttempts, 1);
  assert.equal(s.httpBodyReadOk, 1);
  assert.equal(s.httpAcceptedLoadingFailed, 0);
  assert.equal(h.out.length, 1, "fully read body is emitted to the caller");
});

test("a rejected request never reaches the body-read stages", async () => {
  const h = make();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r9", request: { url: "https://wrong.invalid/x", method: "POST" } }, "");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", { requestId: "r9", response: { status: 200 } }, "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "r9" }, "");
  await new Promise((r) => setTimeout(r, 20));
  const s = h.observer.snapshot();
  assert.equal(s.httpCandidateRejected, 1);
  assert.equal(s.httpBodyReadAttempts, 0);
  assert.equal(h.out.length, 0);
});

test("stage counters carry no url text", async () => {
  const h = make();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r2", request: { url: URL_OK + "?token=secretvalue", method: "POST" } }, "");
  const snap = JSON.stringify(h.observer.snapshot());
  assert.equal(snap.includes("allowed.invalid"), false);
  assert.equal(snap.includes("secretvalue"), false);
});