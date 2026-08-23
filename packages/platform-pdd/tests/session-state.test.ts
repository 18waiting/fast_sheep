import { test } from "node:test";
import assert from "node:assert/strict";
import { PddSessionState } from "../dist/session-state.js";
import { SESSION_STATES } from "../dist/session-state.js";

test("session state machine transitions are explicit", () => {
  const s = new PddSessionState("shop-1", "session-1");
  assert.equal(s.getStatus(), "STOPPED");
  s.setStatus("CREATING");
  s.setStatus("LOADING");
  s.setStatus("READY");
  assert.equal(s.isReady(), true);
  s.setStatus("DISPOSED");
  assert.equal(s.isReady(), false);
});

test("session rejects unknown statuses", () => {
  const s = new PddSessionState("s1", "sid");
  assert.throws(() => s.setStatus("BOGUS" as never));
});

test("session tracks active conversation without cross-shop contamination", () => {
  const s = new PddSessionState("shop-1", "sid");
  s.setStatus("READY");
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
