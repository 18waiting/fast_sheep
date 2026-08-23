import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionState, SESSION_STATES } from "../dist/index.js";
test("session state machine is deterministic", () => {
  const s = new PlatformSessionState("p", "s1", "sid");
  assert.equal(s.getStatus(), "STOPPED");
  s.setStatus("READY");
  assert.equal(s.isReady(), true);
  s.setStatus("DISPOSED");
  assert.equal(s.isReady(), false);
  assert.throws(() => s.setStatus("BOGUS" as never));
});
test("all 8 session states defined", () => { assert.equal(SESSION_STATES.length, 8); });
