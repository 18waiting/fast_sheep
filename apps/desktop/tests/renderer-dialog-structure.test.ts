import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-029 structural guards: the dialog helper is a minimal clean-room primitive
// (overlay + panel + title + close + content) with no generic framework API, no
// close-interaction behaviors (keyboard/overlay/focus/motion), and styles reusing
// existing --fs-* tokens only (no new unproven visual values).
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src", "renderer", "components", "dialog.ts");
const CSS = join(HERE, "..", "src", "renderer", "styles.css");
const DIST = join(HERE, "..", "dist", "renderer", "components", "dialog.js");

const STRUCTURE = ["dialog-overlay", "dialog-panel", "dialog-title", "dialog-close", "dialog-content"];
const FRAMEWORK_TOKENS = ["options", "slot", "registry", "lifecycle", "eventEmitter", "EventEmitter"];
const INTERACTION_TOKENS = ["Escape", "keydown", "keyup", "focusTrap", "returnFocus", "animation", "transition", "requestAnimationFrame", "addEventListener"];

test("dialog helper builds overlay/panel/title/close/content structure", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const s of STRUCTURE) {
    assert.ok(src.includes(s), "dialog.ts must create " + s);
  }
  assert.ok(src.includes('setAttribute("role", "dialog")'), "dialog must declare role=dialog");
  assert.ok(src.includes("aria-modal"), "dialog must declare aria-modal");
});

test("dialog helper keeps a minimal replaceable API (no framework contract)", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.ok(src.includes("export function renderDialog"), "must export a single render function");
  assert.ok(src.includes("DialogParts"), "must export a parts type");
  for (const t of FRAMEWORK_TOKENS) {
    assert.ok(!src.includes(t), "dialog.ts must not introduce " + t);
  }
});

test("dialog implements no unproven close interactions (structural close only)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of INTERACTION_TOKENS) {
    assert.ok(!src.includes(t), "dialog.ts must not implement " + t);
  }
});

test("dialog styles reuse existing tokens only (no new visual values)", () => {
  const css = readFileSync(CSS, "utf-8");
  const start = css.indexOf(".dialog-overlay");
  assert.ok(start >= 0, "styles.css must define dialog rules");
  const end = css.indexOf("SHEEP-045 primitives");
  const block = css.slice(start, end >= 0 ? end : undefined);
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(block), "no hex colors in dialog styles");
  assert.ok(!/\dpx/.test(block), "no px literals in dialog styles");
  for (const t of ["box-shadow", "opacity", "width:", "z-index"]) {
    assert.ok(!block.includes(t), "dialog styles must not add " + t);
  }
});

test("built dialog.js mirrors the same clean-room boundaries", () => {
  const js = readFileSync(DIST, "utf-8");
  for (const s of STRUCTURE) {
    assert.ok(js.includes(s), "dist dialog.js must create " + s);
  }
  for (const t of [...FRAMEWORK_TOKENS, ...INTERACTION_TOKENS]) {
    assert.ok(!js.includes(t), "dist dialog.js must not use " + t);
  }
});