import { test } from "node:test";
import assert from "node:assert/strict";
import { executeTransfer, FALLBACK_TRANSFER_TEXT } from "../dist/dom/transfer-driver.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";

test("transfer executes only the explicit target (GF-PDD-007)", () => {
  const result = executeTransfer(loadFixture("transfer-ready.html"), PDD_SELECTOR_PROFILE, "售后");
  assert.equal(result.ok, true);
  assert.equal(result.executed, true);
});

test("unavailable target fails safely with fallback message, never silent retarget (GF-PDD-006)", () => {
  const result = executeTransfer(loadFixture("transfer-target-missing.html"), PDD_SELECTOR_PROFILE, "售后");
  assert.equal(result.ok, false);
  assert.equal(result.executed, false);
  assert.equal(result.error, "platform.transfer_target_unavailable");
  assert.equal(result.fallback_message, FALLBACK_TRANSFER_TEXT);
});

test("no transfer UI -> dom_unavailable", () => {
  const result = executeTransfer(loadFixture("chat-basic.html"), PDD_SELECTOR_PROFILE, "售后");
  // chat-basic has transfer UI; dom-unsupported does not.
  assert.ok(result.ok === true || result.error === "platform.dom_unavailable");
  const r2 = executeTransfer(loadFixture("dom-unsupported.html"), PDD_SELECTOR_PROFILE, "售后");
  assert.equal(r2.ok, false);
  assert.equal(r2.error, "platform.dom_unavailable");
});
