import { test } from "node:test";
import assert from "node:assert/strict";
import { XIANYU_CAPABILITIES, capabilities } from "../dist/index.js";

test("capability matrix matches the platform spec (PARTIAL evidence, no fake support)", () => {
  const caps = capabilities();
  assert.equal(caps.receive_text, true);
  assert.equal(caps.send_text, true);
  assert.equal(caps.send_image, true);
  assert.equal(caps.transfer, false); // GF-PLAT-002 auto_transfer=false
  assert.equal(caps.desktop_helper, false);
  assert.deepEqual(caps, XIANYU_CAPABILITIES);
});
