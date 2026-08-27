import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-046 architecture-invariant guards for state patterns:
//   - empty meanings explicit (no-work/no-result/not-configured/not-yet-created), no default CTA (DP-41/2)
//   - quiet textual loading, no skeleton/toy animation/fake progress (DP-42)
//   - error scope inline/section/workspace; no error dialog (DP-43); no raw impl details (DP-10)
//   - thin patterns, no mega renderState framework (DP-46)
//   - absence must not conceal denial/unavailability/not-configured (DP-48: explicit meaning)
//   - exactly the listed consumers migrated (DP-44)
const HERE = dirname(fileURLToPath(import.meta.url));
const S = join(HERE, "..", "src", "renderer", "components", "states");
const EMPTY = join(S, "empty.ts");
const LOADING = join(S, "loading.ts");
const ERROR = join(S, "error.ts");
const R = join(HERE, "..", "src", "renderer", "components");
const GALLERY = join(HERE, "..", "..", "..", "reports", "visual-evidence", "state-gallery.html");

const FRAMEWORK_TOKENS = ["renderState", "framework", "slot", "registry", "variantEngine", "themeProvider"];

test("empty meanings explicit; no default CTA (DP-41/2)", () => {
  const src = readFileSync(EMPTY, "utf-8");
  for (const m of ["no-work", "no-result", "not-configured", "not-yet-created"]) {
    assert.ok(src.includes(m), "empty meaning must exist: " + m);
  }
  assert.ok(src.includes("data-state-meaning"), "meaning must be explicit");
  assert.ok(src.includes("options.action") && src.includes("if (options.action)"), "action only when provided (no default CTA)");
  assert.ok(!src.includes("entitlement") && !src.includes("auth"), "no entitlement/auth UI in empty pattern (DP-48 boundary)");
});

test("loading is quiet textual; no skeleton/animation/fake progress (DP-42)", () => {
  const src = readFileSync(LOADING, "utf-8");
  assert.ok(src.includes("setAttribute(\"role\", \"status\")"), "loading declares status role");
  for (const t of ["skeleton", "animation", "spinner", "progressbar", "transition", "requestAnimationFrame"]) {
    assert.ok(!src.includes(t), "loading must not use " + t);
  }
  assert.ok(!src.includes("fs-status"), "loading not primarily a status badge");
});

test("error scope inline/section/workspace; no dialog; no raw impl details (DP-43/10/47)", () => {
  const src = readFileSync(ERROR, "utf-8");
  for (const s of ["inline", "section", "workspace"]) assert.ok(src.includes(s), "error scope: " + s);
  assert.ok(src.includes("setAttribute(\"role\", \"alert\")"), "error declares alert role");
  assert.ok(!src.includes("dialog"), "no error dialog");
  assert.ok(!/sqlite|rpc|provider|credential|password|access_token/.test(src), "no raw implementation details in copy/pattern");
  assert.ok(src.includes("scope"), "failure scope explicit (DP-47)");
});

test("thin patterns, no mega state component (DP-46)", () => {
  for (const f of [EMPTY, LOADING, ERROR]) {
    const src = readFileSync(f, "utf-8");
    for (const t of FRAMEWORK_TOKENS) assert.ok(!src.includes(t), basename(f) + " must not introduce " + t);
  }
});

test("exactly the listed consumers migrated to state patterns (DP-44)", () => {
  for (const [file, fn] of [
    ["error-banner.ts", "errorState"],
    ["conversation-panel.ts", "emptyState"],
    ["suggestion-panel.ts", "emptyState"]
  ]) {
    const src = readFileSync(join(R, file), "utf-8");
    assert.ok(src.includes(fn), file + " must use " + fn);
  }
  const styles = readFileSync(join(HERE, "..", "src", "renderer", "styles.css"), "utf-8");
  assert.ok(styles.includes("fs-state--error.fs-state--workspace"), "workspace error style exists");
});

test("state gallery exists as evidence-only (not production runtime) and covers required concepts", () => {
  assert.ok(existsSync(GALLERY), "state gallery must exist");
  const g = readFileSync(GALLERY, "utf-8");
  assert.ok(g.includes("evidence-only"), "gallery must be marked evidence-only");
  assert.ok(!g.includes("main.js") && !g.includes("app-shell"), "gallery must not reference production renderer runtime");
  for (const c of ["no-work", "no-result", "initial loading", "quiet refresh", "inline error", "workspace", "AI-assistance failure"]) {
    assert.ok(g.toLowerCase().includes(c.toLowerCase()), "gallery must cover: " + c);
  }
});

function basename(p) {
  return p.split(/[\\/]/).pop();
}