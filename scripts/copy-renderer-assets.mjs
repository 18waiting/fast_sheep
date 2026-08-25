// Clean-room helper (M6): copies static renderer assets next to compiled JS.
// tsc does not copy .html/.css; Electron loads dist/renderer/index.html.
//
// SHEEP-025-CR1 (post-closure corrective): the stylesheet copy list is DERIVED from
// index.html local stylesheet references, so every stylesheet the entry document
// links (tokens.css, styles.css, ...) is guaranteed to reach dist/renderer/.
// A missing referenced stylesheet fails the build — there is no silent fallback.
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "apps", "desktop", "src", "renderer");
const DIST = join(HERE, "..", "apps", "desktop", "dist", "renderer");

mkdirSync(DIST, { recursive: true });

function fail(message) {
  console.error("FATAL: " + message);
  process.exit(1);
}

// 1) entry document
const entryName = "index.html";
const entrySrc = join(SRC, entryName);
if (!existsSync(entrySrc)) fail("missing source entry document: " + entrySrc);
const html = readFileSync(entrySrc, "utf-8");

// 2) local stylesheet references: <link rel="stylesheet" href="./X.css" ... />
const stylesheetHrefs = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)]
  .map((tag) => tag[0])
  .map((tag) => { const m = /href=["']([^"']+)["']/i.exec(tag); return m ? m[1] : null; })
  .filter((href) => href && href.startsWith("./") && href.endsWith(".css"))
  .map((href) => href.slice(2));

if (stylesheetHrefs.length === 0) {
  fail(entryName + " must reference at least one local stylesheet (guard would be meaningless)");
}

// 3) copy entry + every referenced stylesheet
const names = [entryName, ...stylesheetHrefs];
for (const name of names) {
  const srcPath = join(SRC, name);
  if (!existsSync(srcPath)) fail("renderer asset missing in src: " + srcPath);
  copyFileSync(srcPath, join(DIST, name));
  console.log("copied " + name);
}

// 4) permanent regression guard: every copied asset must exist in dist afterwards
for (const name of names) {
  const distPath = join(DIST, name);
  if (!existsSync(distPath)) fail("renderer asset not present in dist after copy: " + distPath);
}

console.log("renderer assets OK: " + names.join(", "));