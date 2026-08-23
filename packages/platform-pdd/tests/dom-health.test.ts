import { test } from "node:test";
import assert from "node:assert/strict";
import { domHealth } from "../dist/dom/dom-health.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";

test("chat-basic fixture is DOM-ready", () => {
  const h = domHealth(loadFixture("chat-basic.html"), PDD_SELECTOR_PROFILE);
  assert.equal(h.ready, true);
});

test("dom-unsupported fixture fails safe with DOM_UNSUPPORTED", () => {
  const h = domHealth(loadFixture("dom-unsupported.html"), PDD_SELECTOR_PROFILE);
  assert.equal(h.ready, false);
  assert.equal(h.reason, "DOM_UNSUPPORTED");
  assert.ok(h.missing.length > 0);
});

test("login-required fixture still reports a login marker", () => {
  const doc = loadFixture("login-required.html");
  assert.ok(doc.querySelector("[data-fw-pdd-login]") !== null);
});
