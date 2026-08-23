import { test } from "node:test";
import assert from "node:assert/strict";
import { DoudianSessionState, DOUDIAN_SESSION_STATES } from "../dist/index.js";

test("session state machine transitions deterministically", () => {
  const s = new DoudianSessionState("doudian", "shop-1", "s1");
  assert.equal(s.getStatus(), "STOPPED");
  s.setStatus("READY");
  assert.equal(s.isReady(), true);
  s.setStatus("DISPOSED");
  assert.equal(s.isReady(), false);
});

test("all 8 session states defined", () => {
  for (const st of ["STOPPED", "CREATING", "LOADING", "LOGIN_REQUIRED", "READY", "DOM_UNSUPPORTED", "ERROR", "DISPOSED"]) {
    assert.ok(DOUDIAN_SESSION_STATES.includes(st as never), st);
  }
});
