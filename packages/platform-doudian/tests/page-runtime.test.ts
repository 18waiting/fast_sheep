import { test } from "node:test";
import assert from "node:assert/strict";
import { DoudianPageRuntime, dispatchDoudianCommand, DOUDIAN_COMMAND_ALLOWLIST, FORBIDDEN_COMMAND_TYPES } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";
import { doudianSendText, doudianExecuteTransfer } from "../dist/index.js";

test("page runtime boots, scans inbound, and routes commands", async () => {
  const events: string[] = [];
  const doc = loadFixture("chat-basic.html");
  const runtime = new DoudianPageRuntime({
    platform: "doudian",
    doc,
    sessionId: "s1",
    shopId: "shop-1",
    profile: { version: "doudian-dom-1.0.0", platform: "doudian", entries: [] },
    handlers: {
      health: (c) => ({ command_id: c.command_id, ok: true }),
      scan: (c) => ({ command_id: c.command_id, ok: true, result: { messages: [] } }),
      send_text: (c) => { const r = doudianSendText(doc, c.conversation_id ?? "", c.text ?? ""); return { command_id: c.command_id, ok: r.ok, result: { message_id: r.message_id } }; },
      send_image: (c) => ({ command_id: c.command_id, ok: false, error: "capability.unsupported" }),
      transfer: (c) => { const r = doudianExecuteTransfer(doc, c.target ?? ""); return { command_id: c.command_id, ok: r.ok, result: { executed: r.executed } }; },
      focus_conversation: (c) => ({ command_id: c.command_id, ok: true }),
    },
    transport: { send: (ev) => events.push(ev.event), onCommand: () => () => {} },
    makeObserver: () => ({ observe: () => {}, disconnect: () => {} }),
  });
  runtime.start();
  assert.ok(events.includes("page_ready"));
  runtime.stop();
});

test("command dispatch is a finite allowlist; forbidden types rejected", () => {
  assert.ok(DOUDIAN_COMMAND_ALLOWLIST.includes("send_text"));
  for (const t of FORBIDDEN_COMMAND_TYPES) {
    assert.ok(!DOUDIAN_COMMAND_ALLOWLIST.includes(t as never));
  }
  const r = dispatchDoudianCommand({ type: "execute_js", command_id: "x", session_id: "s" }, {
    health: () => ({ command_id: "x", ok: true }),
    scan: () => ({ command_id: "x", ok: true }),
    send_text: () => ({ command_id: "x", ok: true }),
    send_image: () => ({ command_id: "x", ok: true }),
    transfer: () => ({ command_id: "x", ok: true }),
    focus_conversation: () => ({ command_id: "x", ok: true }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "platform.invalid_command");
});
