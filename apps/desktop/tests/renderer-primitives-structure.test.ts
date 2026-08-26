import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-045 architecture-invariant guards for Component Primitives:
//   - thin DOM helpers + semantic class contracts only (DP-38: no component framework)
//   - action prominence x intent orthogonal; destructive = intent, not status (DP-35)
//   - native <button> semantics (DP-40)
//   - semantic text roles, no numeric heading levels (DP-37)
//   - minimal primitive set; badge presentation separated from status (DP-36)
//   - every primitive has a declared consumer (DP-39: no dead primitives)
const HERE = dirname(fileURLToPath(import.meta.url));
const P = join(HERE, "..", "src", "renderer", "components", "primitives");
const ACTION = join(P, "action.ts");
const TEXT = join(P, "text.ts");
const STATUS = join(P, "status.ts");
const DOC = join(HERE, "..", "..", "..", "docs", "fast-sheep-component-primitives.md");
const GALLERY = join(HERE, "..", "..", "..", "reports", "visual-evidence", "primitive-gallery.html");

const FRAMEWORK_TOKENS = ["slot", "registry", "stateManager", "themeProvider", "variantEngine", "createComponent", "observer"];

test("primitives are thin helpers with no component framework (DP-38)", () => {
  for (const f of [ACTION, TEXT, STATUS]) {
    const src = readFileSync(f, "utf-8");
    for (const t of FRAMEWORK_TOKENS) {
      assert.ok(!src.includes(t), basename(f) + " must not introduce " + t);
    }
  }
});

test("action prominence and intent are orthogonal; native button; destructive = intent not status (DP-35/40)", () => {
  const src = readFileSync(ACTION, "utf-8");
  assert.ok(src.includes('el("button"'), "must create native <button>");
  assert.ok(src.includes("prominence"), "prominence axis exists");
  assert.ok(src.includes("intent"), "intent axis exists");
  assert.ok(src.includes("destructive"), "destructive intent exists");
  assert.ok(!src.includes("div-role-button") && !src.includes("role=\"button\""), "no div-role-button");
  assert.ok(!src.includes("button-success") && !src.includes("button-warning"), "no business-status button system");
  assert.ok(src.includes("primary") && src.includes("secondary") && src.includes("quiet"), "minimal prominence set primary/secondary/quiet");
  assert.ok(!src.includes("tertiary") && !src.includes("ghost"), "no unneeded tertiary/ghost");
});

test("text roles are semantic, not numeric heading levels (DP-37)", () => {
  const src = readFileSync(TEXT, "utf-8");
  for (const role of ["work-object-title", "section-title", "component-title", "body", "label", "metadata"]) {
    assert.ok(src.includes(role), "text role must exist: " + role);
  }
  assert.ok(!/["']h[1-6]["']/.test(src), "must not lock HTML heading levels");
});

test("status canonical roles limited; badge separated from status (DP-36/27)", () => {
  const src = readFileSync(STATUS, "utf-8");
  for (const role of ["neutral", "info", "success", "warning", "danger"]) {
    assert.ok(src.includes(role), "canonical status role: " + role);
  }
  assert.ok(src.includes("badge") && src.includes("fs-badge"), "badge presentation primitive exists");
  assert.ok(!src.includes("StatusBadge"), "no universal StatusBadge");
});

test("every primitive has a declared consumer (DP-39: no dead primitives)", () => {
  const doc = readFileSync(DOC, "utf-8");
  const consumersSection = doc.slice(doc.indexOf("Consumers"));
  assert.ok(consumersSection.includes("actionButton"), "action primitive consumer declared");
  assert.ok(consumersSection.includes("textRole"), "text primitive consumer declared");
  assert.ok(consumersSection.includes("statusMarker"), "status primitive consumer declared");
});

test("primitive gallery exists as evidence-only (not production runtime)", () => {
  assert.ok(existsSync(GALLERY), "gallery html must exist");
  const gallery = readFileSync(GALLERY, "utf-8");
  assert.ok(gallery.includes("evidence-only"), "gallery must be marked evidence-only");
  assert.ok(!gallery.includes("main.js") && !gallery.includes("app-shell"), "gallery must not reference production renderer runtime");
});

function basename(p) {
  return p.split(/[\\/]/).pop();
}