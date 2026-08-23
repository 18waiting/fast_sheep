import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeQianniuMessage } from "../dist/index.js";

test("qianniu normalization uses the canonical contract", () => {
  const msg = normalizeQianniuMessage({ shop_id: "s1", conversation_id: "c1", buyer_id: "b1", raw: { unread: true, buyer: "测试买家", content: "有货吗", platform_message_id: "mid-1" } });
  assert.equal(msg.platform, "qianniu");
  assert.equal(msg.content, "有货吗");
  assert.equal(msg.direction, "inbound");
  assert.ok(!("raw_html" in msg));
});
