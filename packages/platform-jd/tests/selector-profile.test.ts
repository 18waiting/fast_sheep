import { test } from "node:test";
import assert from "node:assert/strict";
import { JD_SELECTOR_PROFILE } from "../dist/index.js";

test("selector profile is versioned and centralized", () => {
  assert.equal(JD_SELECTOR_PROFILE.version, "jd-dom-1.0.0");
  assert.equal(JD_SELECTOR_PROFILE.platform, "jd");
  for (const e of JD_SELECTOR_PROFILE.entries) {
    assert.ok(["CONFIRMED", "PARTIAL", "DESIGN", "UNKNOWN"].includes(e.provenance), e.key);
    assert.ok(e.primary.length > 0);
  }
  assert.ok(JD_SELECTOR_PROFILE.entries.every((e) => e.provenance !== "CONFIRMED"));
});

test("no dangerously broad selectors", () => {
  for (const e of JD_SELECTOR_PROFILE.entries) {
    for (const sel of [e.primary, ...(e.fallbacks ?? [])]) {
      assert.ok(!/^input$/.test(sel) && !/button:last-child/.test(sel) && !/^\[role=button\]$/.test(sel), sel);
    }
  }
});
