import { test } from "node:test";
import assert from "node:assert/strict";
import { createKuaishouPlatformAdapter } from "../dist/index.js";
import { KuaishouSessionState } from "../dist/index.js";
import type { KuaishouPageBridge } from "../dist/index.js";

function makeAdapter() {
  const session = new KuaishouSessionState("kuaishou", "shop-1", "s1");
  session.setStatus("READY");
  const calls: string[] = [];
  const bridge: KuaishouPageBridge = {
    execute: async (cmd) => { calls.push(cmd.type + ":" + (cmd.text ?? cmd.target ?? "")); return { command_id: cmd.command_id, ok: true, result: { message_id: "ack" } }; },
  };
  const adapter = createKuaishouPlatformAdapter({ bridge, session, commandIdFactory: () => "c1" });
  return { adapter, calls };
}

test("sendText sends exactly one segment (no split/sleep)", async () => {
  const { adapter, calls } = makeAdapter();
  const res = await adapter.sendText("shop-1", "c1", ["A###B###C"]);
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["send_text:A###B###C"]);
});

test("capability-gated transfer executes explicit target only", async () => {
  const { adapter } = makeAdapter();
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: true, target: "售后" });
  assert.equal(res.executed, true);
  const no = await adapter.executeTransfer("shop-1", "c1", { requested: true });
  assert.equal(no.executed, false);
});
