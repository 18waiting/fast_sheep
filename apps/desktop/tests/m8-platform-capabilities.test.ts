import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilitiesFor } from "../dist/main/platforms/platform-capability-registry.js";

// FastWork realignment B3: PDD is the only declared matrix; everything else fails closed.
test("capability registry reflects the PDD package-declared matrix", () => {
  const caps = capabilitiesFor("pdd");
  assert.equal(caps.receive_text, true);
  assert.equal(caps.send_text, true);
  assert.equal(caps.transfer, true);
  assert.equal(caps.desktop_helper, false);
});

test("the registry hands out copies (callers cannot mutate declared state)", () => {
  const caps = capabilitiesFor("pdd");
  caps.send_text = false;
  assert.equal(capabilitiesFor("pdd").send_text, true);
});

test("unknown or removed platform returns all-false (never silently promoted)", () => {
  for (const id of ["nope", "doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    const caps = capabilitiesFor(id as never);
    assert.equal(caps.receive_text, false, id);
    assert.equal(caps.send_text, false, id);
    assert.equal(caps.send_image, false, id);
    assert.equal(caps.manual_takeover_detection, false, id);
    assert.equal(caps.conversation_selection, false, id);
    assert.equal(caps.transfer, false, id);
    assert.equal(caps.product_context, false, id);
    assert.equal(caps.order_context, false, id);
    assert.equal(caps.desktop_helper, false, id);
  }
});
