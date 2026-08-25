import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-025-CR1 permanent regression guard:
// every local stylesheet referenced by index.html must exist in dist/renderer after build.
// Runs after `pnpm run build` (test script builds first), so dist is the real build output.
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_RENDERER = join(HERE, "..", "src", "renderer");
const DIST_RENDERER = join(HERE, "..", "dist", "renderer");

function localStylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)]
    .map((tag) => tag[0])
    .map((tag) => { const m = /href=["']([^"']+)["']/i.exec(tag); return m ? m[1] : null; })
    .filter((href) => href && href.startsWith("./") && href.endsWith(".css"))
    .map((href) => href.slice(2));
}

test("renderer build emits every local stylesheet referenced by index.html (dist)", () => {
  const distHtmlPath = join(DIST_RENDERER, "index.html");
  assert.ok(existsSync(distHtmlPath), "dist/renderer/index.html must exist after build");
  const distHtml = readFileSync(distHtmlPath, "utf-8");
  const refs = localStylesheetHrefs(distHtml);
  assert.ok(refs.length > 0, "built index.html must reference at least one local stylesheet");
  for (const ref of refs) {
    assert.ok(existsSync(join(DIST_RENDERER, ref)), `dist/renderer/${ref} must exist after build`);
  }
});

test("tokens.css and styles.css are present in the built renderer (SHEEP-025-CR1)", () => {
  assert.ok(existsSync(join(DIST_RENDERER, "tokens.css")), "dist/renderer/tokens.css must exist after build");
  assert.ok(existsSync(join(DIST_RENDERER, "styles.css")), "dist/renderer/styles.css must exist after build");
});

test("index.html local stylesheet references resolve in src too (no dangling links)", () => {
  const srcHtml = readFileSync(join(SRC_RENDERER, "index.html"), "utf-8");
  const refs = localStylesheetHrefs(srcHtml);
  assert.ok(refs.length > 0, "src index.html must reference at least one local stylesheet");
  for (const ref of refs) {
    assert.ok(existsSync(join(SRC_RENDERER, ref)), `src/renderer/${ref} must exist`);
  }
});