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

test("rejected pathnames are tallied by pathname only, without origin, query or values", async () => {
  const wc = new FakeWebContents();
  const observer = new PddInboundObserver({
    webContents: wc, shopId: "s1", allowedUrl: () => true,
    allowedHttpRequest: (m, u) => u === "https://allowed.invalid/wanted",
    getDocumentBinding: () => ({ sessionId: "sess", shopId: "s1", documentGeneration: 1 }),
    onConnection: () => {}, onFrame: () => {}, onHttpResponse: () => {},
  });
  const handle = observer.start();
  await handle.enablePromise;
  wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "a", request: { url: "https://other.invalid/plateau/chat/latest_conversations?token=SECRET&uid=123", method: "POST" } }, "");
  wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "b", request: { url: "https://other.invalid/plateau/chat/latest_conversations?token=SECRET2", method: "POST" } }, "");
  const snap = observer.snapshot();
  const tally = snap.httpRejectedPathnames;
  assert.equal(tally["/plateau/chat/latest_conversations"], 2, "pathname tally counts both");
  const json = JSON.stringify(snap);
  assert.equal(json.includes("SECRET"), false, "query values must never be recorded");
  assert.equal(json.includes("other.invalid"), false, "origin must never be recorded");
  assert.equal(json.includes("uid=123"), false);
});