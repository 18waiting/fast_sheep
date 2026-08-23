import { test } from "node:test";
import assert from "node:assert/strict";
import { PDD_SELECTOR_PROFILE, requiredSelectors, selector } from "../dist/selector-profile.js";

test("selector profile is versioned and centralized", () => {
  assert.equal(PDD_SELECTOR_PROFILE.platform, "pdd");
  assert.match(PDD_SELECTOR_PROFILE.version, /^pdd-dom-\d+\.\d+\.\d+$/);
  assert.ok(PDD_SELECTOR_PROFILE.entries.length >= 18);
});

test("every selector has explicit provenance (never fabricated CONFIRMED)", () => {
  for (const e of PDD_SELECTOR_PROFILE.entries) {
    assert.ok(["CONFIRMED", "PARTIAL", "DESIGN"].includes(e.provenance), e.key + " provenance");
    assert.ok(e.primary.length > 0, e.key + " primary");
    assert.ok(e.purpose.length > 0, e.key + " purpose");
  }
  // No selector is marked CONFIRMED because exact production DOM was not observed.
  assert.ok(PDD_SELECTOR_PROFILE.entries.every((e) => e.provenance !== "CONFIRMED"));
});

test("required selectors exist for the synthetic DOM contract", () => {
  const required = requiredSelectors(PDD_SELECTOR_PROFILE).map((e) => e.key);
  for (const key of ["chat.list", "conversation.item", "conversation.active", "messages.container", "message.row", "message.content", "composer.input", "composer.send"]) {
    assert.ok(required.includes(key), key);
  }
});

test("no dangerously broad fallback selectors", () => {
  for (const e of PDD_SELECTOR_PROFILE.entries) {
    for (const sel of [e.primary, ...(e.fallbacks ?? [])]) {
      assert.ok(!/^input$/.test(sel), "bare input selector: " + sel);
      assert.ok(!/button:last-child/.test(sel), "button:last-child: " + sel);
      assert.ok(!/^\[role=button\]$/.test(sel), "[role=button]: " + sel);
    }
  }
});

test("selector() returns entries by key", () => {
  assert.equal(selector(PDD_SELECTOR_PROFILE, "composer.send")?.primary, "[data-fw-pdd-send-btn]");
  assert.equal(selector(PDD_SELECTOR_PROFILE, "missing"), undefined);
});
