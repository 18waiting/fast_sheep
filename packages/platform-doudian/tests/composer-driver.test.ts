import { test } from "node:test";
import assert from "node:assert/strict";
import { doudianComposerState, doudianSendText } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("sendText sends exactly one segment; disabled fails safe", () => {
  const ok = doudianSendText(loadFixture("send-text-ready.html"), "c1", "亲,有的~");
  assert.equal(ok.ok, true);
  const disabled = doudianSendText(loadFixture("send-text-disabled.html"), "c1", "x");
  assert.equal(disabled.ok, false);
  assert.equal(disabled.error, "platform.dom_unavailable");
  assert.equal(doudianComposerState(loadFixture("send-text-disabled.html")).disabled, true);
});

test("missing composer fails safe (no approximate clicks)", () => {
  const r = doudianSendText(loadFixture("dom-unsupported.html"), "c1", "x");
  assert.equal(r.ok, false);
  assert.equal(r.error, "platform.dom_unavailable");
});
