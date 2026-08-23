import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_HANDLERS } from "../dist/main/ipc/command-handlers.js";
import type { CommandDeps } from "../dist/main/ipc/command-handlers.js";

function makeSpyHost() {
  const calls: string[] = [];
  const host = {
    setMode: async (shopId: string, conversationId: string, mode: string) => { calls.push(`setMode:${shopId}:${conversationId}:${mode}`); },
    manualSend: async (shopId: string, conversationId: string) => { calls.push(`manualSend:${shopId}:${conversationId}`); },
    noSaveSend: async (shopId: string, conversationId: string) => { calls.push(`noSaveSend:${shopId}:${conversationId}`); },
    cancel: async (shopId: string, conversationId: string) => { calls.push(`cancel:${shopId}:${conversationId}`); },
    focus: (shopId: string) => { calls.push(`focus:${shopId}`); },
  };
  return { host, calls };
}

test("orchestrator.set_mode forwards to host with GF-ORCH-003 semantics intact", async () => {
  const { host, calls } = makeSpyHost();
  const handler = COMMAND_HANDLERS["orchestrator.set_mode"]({ orchestrator: host } as CommandDeps);
  const res = await handler({ shop_id: "s1", conversation_id: "c1", mode: "full_auto" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["setMode:s1:c1:full_auto"]);
});

test("orchestrator.manual_send forwards MANUAL intent to the M5 orchestrator", async () => {
  const { host, calls } = makeSpyHost();
  const handler = COMMAND_HANDLERS["orchestrator.manual_send"]({ orchestrator: host } as CommandDeps);
  const res = await handler({ shop_id: "s1", conversation_id: "c1" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["manualSend:s1:c1"]);
});

test("orchestrator.no_save_send forwards NO_SAVE intent (no knowledge mutation in M5)", async () => {
  const { host, calls } = makeSpyHost();
  const handler = COMMAND_HANDLERS["orchestrator.no_save_send"]({ orchestrator: host } as CommandDeps);
  const res = await handler({ shop_id: "s1", conversation_id: "c1" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["noSaveSend:s1:c1"]);
});

test("orchestrator.cancel forwards cancel to the pending suggestion controller", async () => {
  const { host, calls } = makeSpyHost();
  const handler = COMMAND_HANDLERS["orchestrator.cancel"]({ orchestrator: host } as CommandDeps);
  const res = await handler({ shop_id: "s1", conversation_id: "c1" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["cancel:s1:c1"]);
});

test("orchestrator.focus forwards focus to the shop registry", async () => {
  const { host, calls } = makeSpyHost();
  const handler = COMMAND_HANDLERS["orchestrator.focus"]({ orchestrator: host } as CommandDeps);
  const res = await handler({ shop_id: "s2" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ["focus:s2"]);
});
