import { test } from "node:test";
import assert from "node:assert/strict";
import { jdImageDriver } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("image driver sends via composer image input when present", () => {
  const r = jdImageDriver(loadFixture("send-image-ready.html"), "c1", "img1");
  assert.equal(r.ok, true);
});

test("image driver fails safe when control absent", () => {
  const r = jdImageDriver(loadFixture("dom-unsupported.html"), "c1", "img1");
  assert.equal(r.ok, false);
});
