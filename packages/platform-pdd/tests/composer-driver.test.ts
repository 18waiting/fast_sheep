import { test } from "node:test";
import assert from "node:assert/strict";
import { readComposerState, sendText, sendImage } from "../dist/dom/composer-driver.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";

test("send-text-ready fixture: composer found and enabled", () => {
  const state = readComposerState(loadFixture("send-text-ready.html"), PDD_SELECTOR_PROFILE);
  assert.equal(state.found, true);
  assert.equal(state.disabled, false);
});

test("sendText sends exactly one segment and returns an ack", () => {
  const doc = loadFixture("send-text-ready.html");
  const result = sendText(doc, PDD_SELECTOR_PROFILE, "c1", "亲,有的~");
  assert.equal(result.ok, true);
  assert.equal(result.message_id, "ack-1");
});

test("sendText never splits ### in the adapter driver", () => {
  const doc = loadFixture("send-text-ready.html");
  const result = sendText(doc, PDD_SELECTOR_PROFILE, "c1", "A###B###C");
  assert.equal(result.ok, true);
  // The driver treats the whole string as ONE segment (M5 already split).
});

test("send-text-disabled fixture fails safe (no send)", () => {
  const state = readComposerState(loadFixture("send-text-disabled.html"), PDD_SELECTOR_PROFILE);
  assert.equal(state.disabled, true);
  const result = sendText(loadFixture("send-text-disabled.html"), PDD_SELECTOR_PROFILE, "c1", "x");
  assert.equal(result.ok, false);
  assert.equal(result.error, "platform.dom_unavailable");
});

test("missing composer/send control -> dom_unavailable, no approximate clicks", () => {
  const result = sendText(loadFixture("dom-unsupported.html"), PDD_SELECTOR_PROFILE, "c1", "x");
  assert.equal(result.ok, false);
  assert.equal(result.error, "platform.dom_unavailable");
});

test("sendImage drives the composer image input", () => {
  const result = sendImage(loadFixture("send-text-ready.html"), PDD_SELECTOR_PROFILE, "c1", "img1");
  assert.equal(result.ok, true);
});
