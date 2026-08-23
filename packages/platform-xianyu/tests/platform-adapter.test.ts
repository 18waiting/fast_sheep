import { test } from "node:test";
import assert from "node:assert/strict";
import { createXianyuPlatformAdapter } from "../dist/index.js";
import { XianyuSessionState } from "../dist/index.js";
import type { XianyuPageBridge } from "../dist/index.js";

function makeAdapter() {
  const session = new XianyuSessionState("xianyu", "shop-1", "s1");
  session.setStatus("READY");
  const calls: string[] = [];
  const bridge: XianyuPageBridge = {
    execute: async (cmd) => { calls.push(cmd.type + ":" + (cmd.text ?? cmd.target ?? "")); return { command_id: cmd.command_id, ok: true, result: { message_id: "ack" } }; },
  };
  const adapter = createXianyuPlatformAdapter({ bridge, session, commandIdFactory: () => "c1" });
  return { adapter, calls };
}

test("sendText sends exactly one segment (no split/sleep)", async () => {
  const { adapter, calls } = makeAdapter();
  const res = await adapter.sendText("shop-1", "c1", ["A###B###C"]);
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["send_text:A###B###C"]);
});

test("xianyu transfer is reference-unsupported (GF-PLAT-002)", async () => {
  const { adapter } = makeAdapter();
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: true, target: "售后" });
  assert.equal(res.ok, false);
  assert.equal(res.error, "capability.unsupported");
  assert.equal(adapter.capabilities().transfer, false);
  assert.equal(adapter.capabilities().send_text, true);
});
