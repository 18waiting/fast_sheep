import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PRELOAD_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "preload", "index.ts");
const PRELOAD_DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "preload", "index.js");

test("preload entry exposes only window.fastworkDesktop via contextBridge", () => {
  const src = readFileSync(PRELOAD_SRC, "utf-8");
  assert.match(src, /contextBridge\.exposeInMainWorld\("fastworkDesktop"/);
  assert.doesNotMatch(src, /exposeInMainWorld\([^)]*ipcRenderer/);
});

test("compiled preload is a single self-contained classic script (no ESM import/export)", () => {
  const dist = readFileSync(PRELOAD_DIST, "utf-8");
  assert.doesNotMatch(dist, /^\s*(import|export)\b/m, "sandboxed preload must not use ESM");
  assert.match(dist, /require\("electron"\)/);
  assert.match(dist, /exposeInMainWorld\("fastworkDesktop"/);
});

test("raw ipcRenderer is never handed to the renderer", () => {
  const src = readFileSync(PRELOAD_SRC, "utf-8");
  // ipcRenderer is used internally but never assigned to the exposed api object.
  const exposeBlock = src.slice(src.indexOf("contextBridge.exposeInMainWorld"));
  assert.doesNotMatch(exposeBlock, /ipcRenderer/);
});
