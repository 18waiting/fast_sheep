import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDoudianMessage } from "../dist/index.js";

test("doudian normalization uses the canonical contract", () => {
  const msg = normalizeDoudianMessage({ shop_id: "s1", conversation_id: "c1", buyer_id: "b1", raw: { unread: true, buyer: "测试买家", content: "有货吗", platform_message_id: "mid-1" } });
  assert.equal(msg.platform, "doudian");
  assert.equal(msg.content, "有货吗");
  assert.equal(msg.direction, "inbound");
  assert.ok(!("raw_html" in msg));
});
