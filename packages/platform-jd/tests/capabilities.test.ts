import { test } from "node:test";
import assert from "node:assert/strict";
import { JD_CAPABILITIES, capabilities, createJDPlatformAdapter } from "../dist/index.js";
import { JDSessionState } from "../dist/index.js";
import type { JDPageBridge } from "../dist/index.js";

test("capability matrix matches the platform spec (PARTIAL evidence, no fake support)", () => {
  const caps = capabilities();
  assert.equal(caps.receive_text, true);
  assert.equal(caps.send_text, true);
  assert.equal(caps.send_image, true);
  assert.equal(caps.transfer, true);
  assert.equal(caps.desktop_helper, false);
  assert.deepEqual(caps, JD_CAPABILITIES);
});

test("jd videoSend is unsupported -> capability.unsupported (GF-PLAT-004)", async () => {
  const caps = capabilities();
  assert.equal(caps.videoSend, undefined, "videoSend is not a supported JD capability");
  const session = new JDSessionState("jd", "shop-1", "s1");
  session.setStatus("READY");
  const bridge: JDPageBridge = { execute: async (cmd) => ({ command_id: cmd.command_id, ok: true }) };
  const adapter = createJDPlatformAdapter({ bridge, session, commandIdFactory: () => "c1" });
  assert.equal(adapter.supports("videoSend"), false);
});
