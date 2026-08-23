import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchCommand, isAllowedCommand, FORBIDDEN_COMMAND_TYPES, buildPageReady, buildMessageReceived } from "../dist/index.js";
test("DOM command allowlist is finite; forbidden commands rejected", () => {
  assert.equal(isAllowedCommand("send_text"), true);
  assert.equal(isAllowedCommand("execute_js"), false);
  for (const t of FORBIDDEN_COMMAND_TYPES) assert.equal(isAllowedCommand(t), false);
  const r = dispatchCommand({ type: "execute_js", command_id: "x", session_id: "s" }, {
    health: () => ({ command_id: "x", ok: true }), scan: () => ({ command_id: "x", ok: true }),
    send_text: () => ({ command_id: "x", ok: true }), send_image: () => ({ command_id: "x", ok: true }),
    transfer: () => ({ command_id: "x", ok: true }), focus_conversation: () => ({ command_id: "x", ok: true }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "platform.invalid_command");
});
test("DOM event builders emit schema-shaped events", () => {
  assert.equal(buildPageReady("s", "READY").event, "page_ready");
  const msg = buildMessageReceived("s", { platform: "jd", shop_id: "s1", conversation_id: "c1", message_type: "text", direction: "inbound", content: "hi" });
  assert.equal(msg.event, "message_received");
});
