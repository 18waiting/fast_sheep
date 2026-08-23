import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilitiesFor } from "../dist/main/platforms/platform-capability-registry.js";

test("capability registry reflects package-declared matrices", () => {
  assert.equal(capabilitiesFor("xianyu").transfer, false);
  assert.equal(capabilitiesFor("qianniu").desktop_helper, true);
  assert.equal(capabilitiesFor("jd").send_text, true);
  assert.equal(capabilitiesFor("pdd").transfer, true);
});

test("unknown platform returns all-false (never silently promoted)", () => {
  const caps = capabilitiesFor("nope" as never);
  assert.equal(caps.transfer, false);
  assert.equal(caps.send_text, false);
});
