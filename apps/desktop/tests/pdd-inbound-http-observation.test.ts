import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PddInboundObserver } from "../dist/main/platforms/pdd/pdd-inbound-observer.js";
import { processPddInboundIngress } from "../dist/main/platforms/pdd/pdd-inbound-ingress.js";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdd-transport");
const sample = JSON.parse(readFileSync(join(FIXTURES, "latest-conversations.sample.json"), "utf8"));
const BODY = JSON.stringify(sample.latest_conversations_customer_inbound);

class FakeDebugger extends EventEmitter {
  attached = false;
  bodies = new Map();
  bodyCalls = 0;
  attach() { this.attached = true; }
  detach() { this.attached = false; this.emit("detach", {}, "test-detach"); }
  isAttached() { return this.attached; }
  sendCommand(method, params) {
    if (method === "Network.getResponseBody") {
      this.bodyCalls += 1;
      const body = this.bodies.get(params && params.requestId);
      return body === undefined ? Promise.reject(new Error("No resource with given identifier")) : Promise.resolve(body);
    }
    return Promise.resolve();
  }
}
class FakeWebContents extends EventEmitter {
  debugger = new FakeDebugger();
  destroyed = false;
  isDestroyed() { return this.destroyed; }
}

const r = (v) => (v === undefined ? { status: "UNKNOWN" } : { status: "RESOLVED", value: v });
const scope = () => ({ merchantId: r("m1"), storeId: r("store-1"), platformAccountId: r("acct-1") });

function makeObserver(opts = {}) {
  const wc = new FakeWebContents();
  const requests = [];
  const responses = [];
  const readDiagnostics = [];
  const binding = { sessionId: "pdd-session-shop-1", shopId: "shop-1", documentGeneration: 1 };
  const observer = new PddInboundObserver({
    webContents: wc as never,
    shopId: "shop-1",
    allowedUrl: (u) => u.startsWith("wss://example.invalid/"),
    allowedHttpRequest: (method, url) => method === "POST" && url === "https://example.invalid/plateau/chat/latest_conversations",
    getDocumentBinding: () => (opts.noBinding ? null : opts.binding || binding),
    onConnection: () => {},
    onFrame: () => {},
    onHttpRequest: (b) => requests.push(b),
    onHttpResponse: (f) => responses.push(f),
    onHttpReadDiagnostic: (f) => readDiagnostics.push(f),
    ...opts.extra,
  });
  return { observer, wc, requests, responses, binding, readDiagnostics };
}

function httpRequestParams(requestId, url = "https://example.invalid/plateau/chat/latest_conversations", method = "POST") {
  return { requestId, request: { url, method } };
}
function httpResponseParams(requestId, status = 200, mimeType = "application/json") {
  return { requestId, response: { status, mimeType } };
}

test("HTTP: trusted request start then finished response emits a decoded body once", async () => {
  const h = makeObserver();
  h.wc.debugger.bodies.set("req-1", { body: BODY, base64Encoded: false });
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-1"), "");
  assert.equal(h.requests.length, 1, "request-start binding emitted");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-1"), "");
  assert.equal(h.responses.length, 0, "response headers alone must NOT produce a body");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-1" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 1);
  assert.equal(h.responses[0].body, BODY);
  assert.equal(h.responses[0].binding.connection.shopId, "shop-1");
  assert.equal(h.responses[0].binding.connection.cdpSessionId, "");
});

test("HTTP: response without a trusted request start is never emitted", async () => {
  const h = makeObserver();
  h.wc.debugger.bodies.set("ghost", { body: BODY, base64Encoded: false });
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("ghost"), "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "ghost" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 0, "no post-hoc binding may be invented");
});

test("HTTP: disallowed method/origin/path never creates a binding or reads a body", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  for (const p of [
    httpRequestParams("r-get", "https://example.invalid/plateau/chat/latest_conversations", "GET"),
    httpRequestParams("r-host", "https://evil.invalid/plateau/chat/latest_conversations", "POST"),
    httpRequestParams("r-path", "https://example.invalid/plateau/other", "POST"),
  ]) {
    h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", p, "");
  }
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "r-get" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.requests.length, 0);
  assert.equal(h.responses.length, 0);
  assert.equal(h.wc.debugger.bodyCalls, 0, "body is never requested for non-allowlisted traffic");
});

test("HTTP: wrong CDP sessionId cannot reuse another session's request binding", async () => {
  const h = makeObserver();
  h.wc.debugger.bodies.set("req-x", { body: BODY, base64Encoded: false });
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-x"), "session-A");
  assert.equal(h.requests.length, 0, "only the authorised CDP sessionId is accepted");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-x" }, "session-B");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 0);
});

test("HTTP: navigation during body read invalidates the pending response", async () => {
  const h = makeObserver();
  let releaseBody;
  h.wc.debugger.bodies.set("req-nav", { body: BODY, base64Encoded: false });
  const originalSend = h.wc.debugger.sendCommand.bind(h.wc.debugger);
  h.wc.debugger.sendCommand = (method, params) => {
    if (method === "Network.getResponseBody") {
      return new Promise((res) => { releaseBody = () => res({ body: BODY, base64Encoded: false }); });
    }
    return originalSend(method, params);
  };
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-nav"), "");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-nav"), "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-nav" }, "");
  await new Promise((res) => setTimeout(res, 10));
  // Main document replacement happens while the body is still in flight.
  h.wc.emit("did-start-navigation", {}, "https://example.invalid/next", false, true);
  if (releaseBody) releaseBody();
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 0, "a body resolved after navigation must not be emitted");
});

test("HTTP: body read failure exits without emitting and without retry", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-fail"), "");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-fail"), "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-fail" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 0);
  assert.equal(h.wc.debugger.bodyCalls, 1, "read is attempted once; no retry");
  const snap = h.observer.snapshot();
  assert.equal(snap.httpBodyReadStopped.READ_FAILED, 1, "the failed read is counted under an explicit reason");
  assert.equal(snap.httpBodyReadFailureCauses.NO_RESOURCE, 1, "the CDP cause is recorded, not swallowed");
  assert.equal(h.readDiagnostics.length, 1, "the failure reaches the diagnostic sink");
  assert.equal(h.readDiagnostics[0].reason, "READ_FAILED");
  assert.equal(h.readDiagnostics[0].cause, "NO_RESOURCE");
  assert.equal(h.readDiagnostics[0].requestId, "req-fail");
  assert.equal(h.readDiagnostics[0].pathname, "/plateau/chat/latest_conversations");
  const serialized = JSON.stringify(h.readDiagnostics[0]);
  assert.equal(serialized.includes("?"), false, "the query string never reaches the diagnostic sink");
  assert.equal(serialized.includes("example.invalid"), false, "the origin never reaches the diagnostic sink");
});

test("HTTP: refused body reads report an explicit reason and a sanitized cause", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.bodies.set("req-bin", { body: "AAoAZgAAAGgAAAA=", base64Encoded: true });
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-bin"), "");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-bin"), "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-bin" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.deepEqual(h.observer.snapshot().httpBodyReadStopped, { BODY_BASE64: 1 });
  assert.deepEqual(h.readDiagnostics.map((d) => [d.reason, d.cause]), [["BODY_BASE64", "NONE"]]);
});

test("HTTP: an observation-handler exception is counted instead of disappearing", async () => {
  const h = makeObserver({ extra: { onHttpResponse: () => { throw new Error("sink exploded"); } } });
  h.wc.debugger.bodies.set("req-sink", { body: BODY, base64Encoded: false });
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-sink"), "");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-sink"), "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-sink" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.observer.snapshot().httpObservationHandlerErrors.ERROR_ERROR, 1);
});

test("HTTP: base64/binary bodies are refused instead of guessed", async () => {
  const h = makeObserver();
  h.wc.debugger.bodies.set("req-bin", { body: "AAoAZgAAAGgAAAA=", base64Encoded: true });
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-bin"), "");
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-bin"), "");
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-bin" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 0);
});

test("HTTP: navigation replaces the lifecycle, so an old binding is dropped", async () => {
  const h = makeObserver();
  const handle = h.observer.start();
  await handle.enablePromise;
  h.wc.debugger.emit("message", {}, "Network.requestWillBeSent", httpRequestParams("req-old"), "");
  assert.equal(h.requests.length, 1);
  h.wc.debugger.emit("message", {}, "Network.responseReceived", httpResponseParams("req-old"), "");
  h.wc.emit("did-start-navigation", {}, "https://example.invalid/a", true, true); // initial nav
  h.wc.emit("did-start-navigation", {}, "https://example.invalid/b", false, true); // replacement -> terminal
  h.wc.debugger.emit("message", {}, "Network.loadingFinished", { requestId: "req-old" }, "");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(h.responses.length, 0);
  assert.equal(h.observer.isTerminal, true);
});

test("HTTP: decoded sample still maps through the real mapper and default validator", () => {
  const inputs = [{ payload: sample.latest_conversations_customer_inbound.result.conversations[0], sourceOccurredAt: "1700000005" }];
  const collected = [];
  for (const input of inputs) {
    const result = processPddInboundIngress({
      document: { sessionId: "pdd-session-shop-1", shopId: "shop-1", documentGeneration: 1 },
      input,
      resolveScope: () => scope(),
      resolveIdentity: (m, d) => ({
        runtimeShop: r({ value: d.shopId }),
        scope: scope(),
        runtimeConversationReference: r({ value: "runtime-" + m.customerUid }),
        association: { ownerRuntimeShopId: d.shopId, ownerScope: scope(), platformCustomerId: m.customerUid, platformMessageId: m.platformMessageId, internalConversationId: r("conversation-" + m.customerUid), localMessageId: r("local-" + m.platformMessageId) },
      }),
      canonicalValidator: undefined,
    });
    assert.equal(result.status, "MAPPED");
    collected.push(result.envelope);
  }
  assert.equal(collected.length, 1);
});
