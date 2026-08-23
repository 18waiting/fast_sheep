import { test } from "node:test";
import assert from "node:assert/strict";
import { JobRegistry } from "../dist/index.js";

test("registry registers and resolves runners by type", () => {
  const r = new JobRegistry();
  const fn = async () => ({ ok: true });
  r.register("learning", fn);
  assert.equal(r.get("learning"), fn);
  assert.equal(r.has("learning"), true);
  assert.deepEqual(r.types(), ["learning"]);
  assert.equal(r.get("audit"), undefined);
});
