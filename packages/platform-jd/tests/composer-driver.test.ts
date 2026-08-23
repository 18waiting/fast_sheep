import { test } from "node:test";
import assert from "node:assert/strict";
import { jdComposerState, jdSendText } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("sendText sends exactly one segment; disabled fails safe", () => {
  const ok = jdSendText(loadFixture("send-text-ready.html"), "c1", "亲,有的~");
  assert.equal(ok.ok, true);
  const disabled = jdSendText(loadFixture("send-text-disabled.html"), "c1", "x");
  assert.equal(disabled.ok, false);
  assert.equal(disabled.error, "platform.dom_unavailable");
  assert.equal(jdComposerState(loadFixture("send-text-disabled.html")).disabled, true);
});

test("missing composer fails safe (no approximate clicks)", () => {
  const r = jdSendText(loadFixture("dom-unsupported.html"), "c1", "x");
  assert.equal(r.ok, false);
  assert.equal(r.error, "platform.dom_unavailable");
});
