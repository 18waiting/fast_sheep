import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-043 (REPAIR) architecture-invariant guards:
// the token system must keep its architecture invariants WITHOUT freezing the exact
// visual token inventory (SHEEP-044 may legitimately refine colors/inventory):
//   - primitive + semantic two-layer (DP-22)
//   - shared semantic system, no dual theme (DP-23)
//   - --fs-* namespace + compatibility aliases (DP-24)
//   - light-first / dark-deferred (DP-25)
//   - no AI brand color/skin; Fact/Assistance/Evidence roles provisional (DP-26)
//   - canonical status palette = neutral/info/success/warning/danger only (DP-27);
//     primary = Action/Accent, NOT Status; legacy names = compatibility aliases
//   - density reserved, not implemented (DP-28)
//   - every styles.css var() resolves to a primitive; no alias cycles
const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, "..", "src", "renderer", "tokens.css");
const STYLES = join(HERE, "..", "src", "renderer", "styles.css");
const DIST_TOKENS = join(HERE, "..", "dist", "renderer", "tokens.css");

function tokenDefs(css) {
  const m = new Map();
  for (const x of css.matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)) m.set(x[1], x[2].trim());
  return m;
}

test("primitive + semantic two-layer architecture (DP-22); no raw hex in semantic layer", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  const prims = [...defs.keys()].filter((k) => k.startsWith("--fs-prim-"));
  const sems = [...defs.keys()].filter((k) => !k.startsWith("--fs-prim-"));
  assert.ok(prims.length > 0 && sems.length > 0, "both layers must exist");
  const semSection = css.slice(css.indexOf("Semantic layer"));
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(semSection), "semantic layer must not contain raw hex");
  for (const s of sems) {
    assert.ok(defs.get(s).startsWith("var(--fs-prim-") || defs.get(s).startsWith("var(--fs-color-"), s + " must reference primitive or semantic alias");
  }
});

test("every token resolves to a primitive with no alias cycles (semantic -> primitive)", () => {
  const defs = tokenDefs(readFileSync(TOKENS, "utf-8"));
  const resolve = (name, seen) => {
    seen = seen || new Set();
    if (!defs.has(name)) return { ok: false, reason: "undefined" };
    const v = defs.get(name);
    const refs = [...v.matchAll(/var\((--fs-[\w-]+)\)/g)].map((x) => x[1]);
    if (refs.length === 0) return { ok: true, value: v };
    for (const r of refs) {
      if (seen.has(r)) return { ok: false, reason: "cycle " + name + " -> " + r };
      seen.add(r);
      const sub = resolve(r, seen);
      if (!sub.ok) return sub;
    }
    return { ok: true, value: "resolved" };
  };
  for (const k of defs.keys()) {
    const r = resolve(k);
    assert.ok(r.ok, k + " must resolve: " + r.reason);
  }
  // styles.css 0 undefined
  const styles = readFileSync(STYLES, "utf-8");
  const uses = [...new Set([...styles.matchAll(/var\((--fs-[\w-]+)\)/g)].map((m) => m[1]))];
  assert.ok(uses.length > 0, "styles.css must use tokens");
  for (const u of uses) assert.ok(resolve(u).ok, u + " must resolve");
});

test("canonical status palette = neutral/info/success/warning/danger only (DP-27)", () => {
  const defs = tokenDefs(readFileSync(TOKENS, "utf-8"));
  const canonical = [...defs.keys()].filter((k) => k.startsWith("--fs-color-status-")).sort();
  assert.deepEqual(canonical, [
    "--fs-color-status-danger",
    "--fs-color-status-info",
    "--fs-color-status-neutral",
    "--fs-color-status-success",
    "--fs-color-status-warning"
  ], "canonical status roles must be exactly neutral/info/success/warning/danger (no business-status explosion)");
});

test("primary is Action/Accent, NOT canonical status (DP-27)", () => {
  const defs = tokenDefs(readFileSync(TOKENS, "utf-8"));
  assert.ok(defs.has("--fs-color-primary"), "primary legacy name kept");
  assert.ok(defs.has("--fs-color-action"), "action role exists");
  assert.ok(![...defs.keys()].some((k) => k.startsWith("--fs-color-status-primary")), "primary must NOT be a canonical status");
});

test("legacy status names remain compatibility aliases (DP-24/DP-27)", () => {
  const defs = tokenDefs(readFileSync(TOKENS, "utf-8"));
  for (const k of ["--fs-color-success", "--fs-color-warning", "--fs-color-danger", "--fs-color-error", "--fs-color-warning-strong"]) {
    assert.ok(defs.has(k), k + " must remain (compatibility alias)");
  }
});

test("Fact/Assistance/Evidence roles exist and are marked provisional (DP-26)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  for (const k of ["--fs-color-fact", "--fs-color-fact-secondary", "--fs-color-assistance", "--fs-color-assistance-bg", "--fs-color-evidence", "--fs-color-evidence-bg"]) {
    assert.ok(defs.has(k), k + " must be defined");
  }
  assert.ok(/provisional/i.test(css), "Fact/Assistance/Evidence mapping must be marked provisional");
  assert.ok(css.includes("SHEEP-044"), "final refinement must point to SHEEP-044");
  assert.ok(!/ai/i.test([...defs.keys()].filter((k) => k.startsWith("--fs-color-")).join(" ")), "no AI-brand color token");
});

test("no density implementation; light-first; no external-origin markers (DP-23/25/28)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  for (const k of defs.keys()) assert.ok(!/density/i.test(k), "no density token: " + k);
  for (const k of defs.keys()) assert.ok(!/dark/i.test(k), "no dark-theme token: " + k);
  for (const t of ["fastwork-", "reference-", "original-"]) assert.ok(!css.includes(t), "no external-origin marker: " + t);
  assert.ok(css.includes("NOT implemented") || css.includes("not implemented"), "DP-28 reserved documented");
});

test("built dist tokens.css present (CR1 build guard)", () => {
  assert.ok(existsSync(DIST_TOKENS), "dist/renderer/tokens.css must exist after build");
});