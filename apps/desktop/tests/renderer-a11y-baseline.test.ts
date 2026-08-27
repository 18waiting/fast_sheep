import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-047 accessibility-baseline guards (automated; auxiliary, not a scanner).
//   - WCAG AA contrast for key semantic token combinations (DP-51 mechanical audit)
//   - native tab order: no positive tabindex; focus-visible rules on interactive classes (DP-50)
//   - native semantics first, minimal ARIA (DP-52): no role=button on div, no aria-label spam
//   - real components use native heading elements, not all-div (DP-49)
//   - focus / selected / status visually distinct (DP-56: distinct CSS signals)
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer");
const TOKENS = join(R, "tokens.css");
const STYLES = join(R, "styles.css");
const GALLERY = join(HERE, "..", "..", "..", "reports", "visual-evidence", "a11y-focus-gallery.html");

function walkTs(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walkTs(p) : p.endsWith(".ts") ? [readFileSync(p, "utf-8")] : [];
  });
}
const ALL_COMPONENTS = walkTs(join(R, "components")).join("\n");

function lum(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function resolveToken(defs, name, seen) {
  seen = seen || new Set();
  if (!defs.has(name)) return null;
  const v = defs.get(name);
  const refs = [...v.matchAll(/var\((--fs-[\w-]+)\)/g)].map((x) => x[1]);
  if (refs.length === 0) return v.trim();
  for (const r0 of refs) {
    if (seen.has(r0)) return null;
    seen.add(r0);
    const rr = resolveToken(defs, r0, seen);
    if (rr) return rr;
  }
  return null;
}

test("WCAG AA contrast for key semantic token combinations (DP-51 mechanical audit)", () => {
  const defs = new Map();
  for (const m of readFileSync(TOKENS, "utf-8").matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)) defs.set(m[1], m[2].trim());
  const v = (n) => resolveToken(defs, n);
  const cases = [
    // small-text on surface (AA 4.5)
    [v("--fs-color-text"), v("--fs-color-bg-surface"), 4.5],
    [v("--fs-color-text-secondary"), v("--fs-color-bg-surface"), 4.5],
    [v("--fs-color-text-muted"), v("--fs-color-bg-surface"), 4.5],
    [v("--fs-color-text-muted"), v("--fs-color-bg"), 4.5],
    [v("--fs-color-text-on-primary"), v("--fs-color-primary"), 4.5],
    [v("--fs-color-status-success"), v("--fs-color-bg-surface"), 4.5],
    [v("--fs-color-status-warning"), v("--fs-color-bg-surface"), 4.5],
    [v("--fs-color-status-danger"), v("--fs-color-bg-surface"), 4.5],
    [v("--fs-color-status-info"), v("--fs-color-bg-surface"), 4.5],
    // meaningful UI boundary / focus indicator (3:1)
    [v("--fs-color-border"), v("--fs-color-bg-surface"), 3.0],
    [v("--fs-color-primary"), v("--fs-color-bg-surface"), 3.0],
    [v("--fs-color-primary"), v("--fs-color-bg-selected"), 3.0],
  ];
  for (const [fg, bg, min] of cases) {
    assert.ok(fg && bg, "tokens must resolve: " + String(fg) + " / " + String(bg));
    const r = ratio(fg, bg);
    assert.ok(r >= min, "contrast " + fg + " on " + bg + " = " + r.toFixed(2) + " < " + min);
  }
});

test("native tab order: no positive tabindex; focus-visible rules on interactive classes (DP-50)", () => {
  const all = ALL_COMPONENTS;
  assert.ok(!/tabindex\s*=\s*["']?[1-9]/.test(all), "no positive tabindex");
  const styles = readFileSync(STYLES, "utf-8");
  for (const sel of [".fs-action:focus-visible", ".btn:focus-visible", ".shop-button:focus-visible", ".mode-btn:focus-visible"]) {
    assert.ok(styles.includes(sel), "focus-visible rule missing: " + sel);
  }
});

test("native semantics first, minimal ARIA (DP-52)", () => {
  const all = ALL_COMPONENTS;
  assert.ok(!/role=["']button["']/.test(all), "no role=button on non-native controls");
  assert.ok(!/aria-label=["']([^"']{2,})["'][^>]*aria-label=["']\1["']/.test(all), "no duplicate aria-label");
  assert.ok(!/aria-live=["']assertive["']/.test(all), "no raw assertive announcement spam (DP-55)");
});

test("real components use native heading elements, not all-div (DP-49)", () => {
  for (const f of ["shop-sidebar.ts", "conversation-panel.ts", "suggestion-panel.ts", "empty-platform-panel.ts"]) {
    const src = readFileSync(join(R, "components", f), "utf-8");
    assert.ok(/el\("h[1-6]"/.test(src), f + " must use a native heading element");
  }
});

test("focus / selected / status visually distinct (DP-56)", () => {
  const styles = readFileSync(STYLES, "utf-8");
  assert.ok(styles.includes("outline: 2px solid var(--fs-color-primary)"), "focus = outline (distinct signal)");
  assert.ok(styles.includes(".shop-button.selected") && styles.includes("border-color: var(--fs-color-primary)"), "selected = fill+border (distinct)");
  assert.ok(styles.includes(".fs-status--success"), "status = color+text (distinct)");
});

test("a11y focus gallery exists as evidence-only (DP-13)", () => {
  assert.ok(existsSync(GALLERY), "a11y focus gallery must exist");
  const g = readFileSync(GALLERY, "utf-8");
  assert.ok(g.includes("evidence-only"), "gallery must be marked evidence-only");
  assert.ok(!g.includes("main.js") && !g.includes("app-shell"), "gallery must not reference production runtime");
});