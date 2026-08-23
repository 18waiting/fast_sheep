import { test } from "node:test";
import assert from "node:assert/strict";
import { clampBounds } from "../dist/main/platforms/pdd/pdd-view-host.js";

const CONTENT = { x: 0, y: 0, width: 1200, height: 800, visible: true };

test("bounds are clamped to the main content area", () => {
  const c = clampBounds({ x: 5000, y: 5000, width: 2000, height: 2000, visible: true }, CONTENT);
  assert.ok(c.width <= CONTENT.width);
  assert.ok(c.height <= CONTENT.height);
  assert.ok(c.x >= 0 && c.y >= 0);
});

test("zero/negative sizes clamp safely", () => {
  const c = clampBounds({ x: -5, y: -5, width: -100, height: -100, visible: true }, CONTENT);
  assert.equal(c.width, 0);
  assert.equal(c.height, 0);
  assert.ok(c.x >= 0 && c.y >= 0);
});

test("untrusted renderer payload cannot position outside content area", () => {
  const c = clampBounds({ x: 100, y: 100, width: 500, height: 500, visible: true }, CONTENT);
  assert.ok(c.x + c.width <= CONTENT.width);
  assert.ok(c.y + c.height <= CONTENT.height);
});
