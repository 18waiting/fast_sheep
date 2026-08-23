import { test } from "node:test";
import assert from "node:assert/strict";
import { QIANNIU_CAPABILITIES, capabilities } from "../dist/index.js";

test("capability matrix matches the platform spec (PARTIAL evidence, no fake support)", () => {
  const caps = capabilities();
  assert.equal(caps.receive_text, true);
  assert.equal(caps.send_text, true);
  assert.equal(caps.send_image, true);
  assert.equal(caps.transfer, true); // qn_transfer PARTIAL
  assert.equal(caps.desktop_helper, true); // GF-PLAT-003 desktopHelper=true
  assert.deepEqual(caps, QIANNIU_CAPABILITIES);
});
