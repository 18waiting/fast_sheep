import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage, normalizeScan, fallbackFingerprint } from "../dist/message-normalizer.js";

test("normalizeMessage uses canonical fields and never includes raw HTML", () => {
  const msg = normalizeMessage({
    shop_id: "shop-1", conversation_id: "c1", buyer_id: "b1",
    raw: { unread: true, buyer: "测试买家", content: "<script>alert(1)</script>有货吗", platform_message_id: "mid-1", timestamp: "2026-08-16T00:00:00Z" },
  });
  assert.equal(msg.platform, "pdd");
  assert.equal(msg.shop_id, "shop-1");
  assert.equal(msg.conversation_id, "c1");
  assert.equal(msg.direction, "inbound");
  assert.equal(msg.message_type, "text");
  assert.equal(msg.platform_message_id, "mid-1");
  assert.equal(msg.content, "<script>alert(1)</script>有货吗");
  assert.ok(!("raw_html" in msg));
  assert.ok(!("dom" in msg));
});

test("fallback fingerprint is stable and design-marked", () => {
  const a = fallbackFingerprint({ shop_id: "s1", conversation_id: "c1", raw: { unread: true, content: "有货吗", timestamp: "t1" } });
  const b = fallbackFingerprint({ shop_id: "s1", conversation_id: "c1", raw: { unread: true, content: "有货吗", timestamp: "t1" } });
  assert.equal(a, b);
  assert.match(a, /^fp-/);
});

test("content is bounded", () => {
  const msg = normalizeMessage({ shop_id: "s", conversation_id: "c", raw: { unread: true, content: "x".repeat(5000) } });
  assert.ok(msg.content.length <= 4000);
});

test("normalizeScan preserves DOM order deterministically", () => {
  const out = normalizeScan({ conversation_id: "c1", messages: [
    { unread: true, content: "A", platform_message_id: "m1" },
    { unread: true, content: "B", platform_message_id: "m2" },
    { unread: true, content: "C", platform_message_id: "m3" },
  ] }, "s1");
  assert.deepEqual(out.map((m) => m.content), ["A", "B", "C"]);
  assert.ok(out.every((m) => m.shop_id === "s1"));
});
