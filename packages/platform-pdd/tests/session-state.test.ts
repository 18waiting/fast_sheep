import { test } from "node:test";
import assert from "node:assert/strict";
import { PddSessionState } from "../dist/session-state.js";
import { SESSION_STATES } from "../dist/session-state.js";

function transitionToReady(s: PddSessionState): void {
  s.setStatus("CREATING");
  s.setStatus("LOADING");
  s.setStatus("READY");
}

test("session state machine transitions are explicit", () => {
  const s = new PddSessionState("shop-1", "session-1");
  assert.equal(s.getStatus(), "STOPPED");
  transitionToReady(s);
  assert.equal(s.isReady(), true);
  s.setStatus("DISPOSED");
  assert.equal(s.isReady(), false);
});

test("session rejects illegal transitions and preserves the previous state", () => {
  const s = new PddSessionState("shop-1", "session-1");
  assert.throws(() => s.setStatus("READY"), /illegal PDD session transition/);
  assert.equal(s.getStatus(), "STOPPED");
  transitionToReady(s);
  assert.throws(() => s.setStatus("LOGIN_REQUIRED"), /illegal PDD session transition/);
  assert.equal(s.getStatus(), "READY");
});

test("repeated runtime state signals are idempotent", () => {
  const s = new PddSessionState("shop-1", "session-1");
  transitionToReady(s);
  s.setStatus("READY");
  assert.equal(s.getStatus(), "READY");
});

test("a specific unsupported-page observation may supersede login-required observation", () => {
  const s = new PddSessionState("shop-1", "session-1");
  s.setStatus("CREATING");
  s.setStatus("LOADING");
  s.setStatus("LOGIN_REQUIRED");
  s.setStatus("DOM_UNSUPPORTED", "missing selectors");
  assert.equal(s.getStatus(), "DOM_UNSUPPORTED");
  assert.equal(s.getLastError(), "missing selectors");
});

test("login-required accepts only the fresh page-ready recovery signal", () => {
  const s = new PddSessionState("shop-1", "session-1");
  s.setStatus("CREATING");
  s.setStatus("LOADING");
  s.setStatus("LOGIN_REQUIRED");
  s.setStatus("READY");
  assert.equal(s.getStatus(), "READY");
  assert.equal(s.isReady(), true);
});

test("session rejects unknown statuses", () => {
  const s = new PddSessionState("s1", "sid");
  assert.throws(() => s.setStatus("BOGUS" as never));
});

test("session tracks active conversation without cross-shop contamination", () => {
  const s = new PddSessionState("shop-1", "sid");
  transitionToReady(s);
  s.setConversation("c1", "b1");
  assert.equal(s.getActiveConversationId(), "c1");
  const s2 = new PddSessionState("shop-2", "sid2");
  assert.equal(s2.getActiveConversationId(), null);
  assert.equal(s2.getBuyerId(), null);
});

test("view() exposes only safe presentation fields", () => {
  const s = new PddSessionState("shop-1", "sid");
  s.setStatus("ERROR", "boom at /secret/path " + "x".repeat(500));
  const v = s.view();
  assert.ok(v.last_error!.length <= 200);
  assert.deepEqual(Object.keys(v).sort(), ["active_conversation_id", "buyer_id", "last_error", "session_id", "shop_id", "status"]);
});

test("SESSION_STATES includes all 8 required statuses", () => {
  for (const st of ["STOPPED", "CREATING", "LOADING", "LOGIN_REQUIRED", "READY", "DOM_UNSUPPORTED", "ERROR", "DISPOSED"]) {
    assert.ok(SESSION_STATES.includes(st as never), st);
  }
});
