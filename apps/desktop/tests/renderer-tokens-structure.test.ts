import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-043 structural guards: tokens.css = primitive + semantic two-layer system
// (DP-22), shared semantic system (DP-23), --fs-* namespace kept (DP-24),
// light-first/theme-ready/dark-deferred (DP-25), no AI brand color/skin (DP-26),
// limited semantic status palette (DP-27), density reserved not implemented (DP-28);
// every styles.css var() must resolve (0 undefined), selector/DOM untouched.
const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, "..", "src", "renderer", "tokens.css");
const STYLES = join(HERE, "..", "src", "renderer", "styles.css");
const DIST_TOKENS = join(HERE, "..", "dist", "renderer", "tokens.css");

function tokenDefs(css) {
  const m = new Map();
  for (const x of css.matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)) m.set(x[1], x[2].trim());
  return m;
}

test("tokens.css has primitive + semantic two-layer architecture (DP-22)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  const prims = [...defs.keys()].filter((k) => k.startsWith("--fs-prim-"));
  const sems = [...defs.keys()].filter((k) => !k.startsWith("--fs-prim-"));
  assert.ok(prims.length > 0, "primitive layer must exist");
  assert.ok(sems.length > 0, "semantic layer must exist");
  // semantic layer must reference primitives only (no raw hex after the semantic marker)
  const semSection = css.slice(css.indexOf("Semantic layer"));
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(semSection), "semantic layer must not contain raw hex values");
  for (const s of sems) {
    const v = defs.get(s);
    assert.ok(v.startsWith("var(--fs-prim-"), s + " must reference a primitive");
  }
});

test("--fs-* namespace kept with aliases; existing tokens preserved (DP-24)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  for (const k of ["--fs-color-text", "--fs-color-bg-surface", "--fs-color-primary", "--fs-space-2", "--fs-radius-md", "--fs-font-sans"]) {
    assert.ok(defs.has(k), k + " must remain defined");
  }
  for (const t of ["fastwork-", "reference-", "original-"]) {
    assert.ok(!css.includes(t), "tokens.css must not use " + t);
  }
});

test("no AI brand color / AI skin token (DP-26)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  for (const k of defs.keys()) {
    assert.ok(!/ai/i.test(k), "no AI-brand token name: " + k);
  }
  assert.ok(!css.toLowerCase().includes("purple"), "no AI-purple token value");
});

test("reusable semantic roles Fact / Assistance / Evidence / Action exist (DP-26)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  for (const k of ["--fs-color-fact", "--fs-color-fact-secondary", "--fs-color-assistance", "--fs-color-assistance-bg", "--fs-color-evidence", "--fs-color-evidence-bg", "--fs-color-action"]) {
    assert.ok(defs.has(k), k + " must be defined");
  }
});

test("limited semantic status palette (DP-27)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  const status = [...defs.keys()].filter((k) => /--fs-color-(primary|success|warning|danger|error|warning-strong)$/.test(k)).sort();
  assert.deepEqual(status, ["--fs-color-danger", "--fs-color-error", "--fs-color-primary", "--fs-color-success", "--fs-color-warning", "--fs-color-warning-strong"]);
  const statusBg = [...defs.keys()].filter((k) => /--fs-color-bg-(success|warning|danger|error)$/.test(k)).sort();
  assert.deepEqual(statusBg, ["--fs-color-bg-danger", "--fs-color-bg-error", "--fs-color-bg-success", "--fs-color-bg-warning"]);
});

test("no density switcher / context-density tokens implemented (DP-23/DP-28)", () => {
  const css = readFileSync(TOKENS, "utf-8");
  const defs = tokenDefs(css);
  for (const k of defs.keys()) {
    assert.ok(!/density|--fs-(compact|comfortable)/i.test(k), "no density token implemented: " + k);
  }
  assert.ok(css.includes("NOT implemented"), "DP-28 reserved must be documented");
});

test("every styles.css var() resolves to a primitive (0 undefined)", () => {
  const defs = tokenDefs(readFileSync(TOKENS, "utf-8"));
  const styles = readFileSync(STYLES, "utf-8");
  const uses = [...new Set([...styles.matchAll(/var\((--fs-[\w-]+)\)/g)].map((m) => m[1]))];
  assert.ok(uses.length > 0, "styles.css must use tokens");
  const resolve = (name, seen) => {
    seen = seen || new Set();
    if (!defs.has(name)) return null;
    const v = defs.get(name);
    const refs = [...v.matchAll(/var\((--fs-[\w-]+)\)/g)].map((x) => x[1]);
    if (refs.length === 0) return v;
    for (const r of refs) {
      if (seen.has(r)) return "cycle";
      seen.add(r);
      if (resolve(r, seen) === null) return null;
    }
    return "resolved";
  };
  for (const u of uses) {
    assert.ok(resolve(u) === "resolved", u + " must resolve (got " + resolve(u) + ")");
  }
});

test("built dist tokens.css is present (CR1 build guard)", () => {
  assert.ok(existsSync(DIST_TOKENS), "dist/renderer/tokens.css must exist after build");
});