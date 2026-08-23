import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilities } from "../dist/index.js";

test("qianniu desktop helper is a CONFIRMED special-client boundary (GF-PLAT-003)", () => {
  const caps = capabilities();
  assert.equal(caps.desktop_helper, true);
  // M8 exposes the capability only; rule evaluation stays in M9.
});
