import { test } from "node:test";
import assert from "node:assert/strict";
import { XIANYU_SELECTOR_PROFILE } from "../dist/index.js";

test("selector profile is versioned and centralized", () => {
  assert.equal(XIANYU_SELECTOR_PROFILE.version, "xianyu-dom-1.0.0");
  assert.equal(XIANYU_SELECTOR_PROFILE.platform, "xianyu");
  for (const e of XIANYU_SELECTOR_PROFILE.entries) {
    assert.ok(["CONFIRMED", "PARTIAL", "DESIGN", "UNKNOWN"].includes(e.provenance), e.key);
    assert.ok(e.primary.length > 0);
  }
  assert.ok(XIANYU_SELECTOR_PROFILE.entries.every((e) => e.provenance !== "CONFIRMED"));
});

test("no dangerously broad selectors", () => {
  for (const e of XIANYU_SELECTOR_PROFILE.entries) {
    for (const sel of [e.primary, ...(e.fallbacks ?? [])]) {
      assert.ok(!/^input$/.test(sel) && !/button:last-child/.test(sel) && !/^\[role=button\]$/.test(sel), sel);
    }
  }
});
