import { test } from "node:test";
import assert from "node:assert/strict";
import { syntheticProfile, requiredSelectors } from "../dist/index.js";
test("synthetic profile is parameterized and platform-neutral", () => {
  const p = syntheticProfile("jd", "jd-dom-1.0.0");
  assert.equal(p.platform, "jd");
  assert.equal(p.version, "jd-dom-1.0.0");
  assert.ok(requiredSelectors(p).length >= 8);
  for (const e of p.entries) assert.ok(["CONFIRMED", "PARTIAL", "DESIGN", "UNKNOWN"].includes(e.provenance));
});
