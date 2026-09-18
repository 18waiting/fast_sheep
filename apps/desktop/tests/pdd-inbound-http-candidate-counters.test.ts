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

const r = { status: "RESOLVED" };
function make(allow) {
  const wc = new FakeWebContents();
  const observer = new PddInboundObserver({
    webContents: wc, shopId: "s1", allowedUrl: () => true, allowedHttpRequest: allow,
    getDocumentBinding: () => ({ sessionId: "sess", shopId: "s1", documentGeneration: 1 }),
    onConnection: () => {}, onFrame: () => {},
  });
  return { wc, observer };
}

test("sanitized counters distinguish 'no candidate request' from 'candidate refused'", async () => {
  const allow = (m, u) => m === "POST" && u === "https://allowed.invalid/plateau/chat/latest_conversations";
  const h = make(allow);
  const handle = h.observer.start();
  await handle.enablePromise;

  // no request at all
  assert.equal(h.observer.snapshot().httpCandidateChecks, 0);

  // a request that the allowlist refuses
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r1", request: { url: "https://other.invalid/plateau/chat/latest_conversations", method: "POST" } }, "");
  assert.equal(h.observer.snapshot().httpCandidateChecks, 1);
  assert.equal(h.observer.snapshot().httpCandidateRejected, 1);

  // a request the allowlist accepts
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r2", request: { url: "https://allowed.invalid/plateau/chat/latest_conversations", method: "POST" } }, "");
  assert.equal(h.observer.snapshot().httpCandidateChecks, 2);
  assert.equal(h.observer.snapshot().httpCandidateRejected, 1, "accepted request is not counted as rejected");
});

test("counters record no URL text", async () => {
  const h = make(() => false);
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", { requestId: "r3", request: { url: "https://secret.invalid/x?token=abc123", method: "POST" } }, "");
  const snap = JSON.stringify(h.observer.snapshot());
  assert.equal(snap.includes("secret.invalid"), false, "url text must not appear in the snapshot");
  assert.equal(snap.includes("abc123"), false, "query values must not appear in the snapshot");
});