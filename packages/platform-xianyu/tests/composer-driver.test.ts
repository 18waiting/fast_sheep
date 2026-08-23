import { test } from "node:test";
import assert from "node:assert/strict";
import { xianyuComposerState, xianyuSendText } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("sendText sends exactly one segment; disabled fails safe", () => {
  const ok = xianyuSendText(loadFixture("send-text-ready.html"), "c1", "亲,有的~");
  assert.equal(ok.ok, true);
  const disabled = xianyuSendText(loadFixture("send-text-disabled.html"), "c1", "x");
  assert.equal(disabled.ok, false);
  assert.equal(disabled.error, "platform.dom_unavailable");
  assert.equal(xianyuComposerState(loadFixture("send-text-disabled.html")).disabled, true);
});

test("missing composer fails safe (no approximate clicks)", () => {
  const r = xianyuSendText(loadFixture("dom-unsupported.html"), "c1", "x");
  assert.equal(r.ok, false);
  assert.equal(r.error, "platform.dom_unavailable");
});
