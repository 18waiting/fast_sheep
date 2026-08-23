import { test } from "node:test";
import assert from "node:assert/strict";
import { PddOrchestratorBridge } from "../dist/main/platforms/pdd/pdd-orchestrator-bridge.js";

function makeOrchestrator() {
  const calls: string[] = [];
  return {
    calls,
    onBuyerMessage: async (shopId: string, conversationId: string, msg: unknown) => {
      calls.push(`message:${shopId}:${conversationId}:${(msg as { content?: string }).content}`);
    },
    onHumanTakeover: async (shopId: string, conversationId: string) => {
      calls.push(`takeover:${shopId}:${conversationId}`);
    },
    onFocusShop: (shopId: string) => { calls.push(`focus:${shopId}`); },
  } as never;
}

test("bridge forwards normalized inbound messages through the public M5 API", async () => {
  const orc = makeOrchestrator();
  const bridge = new PddOrchestratorBridge(orc as never);
  await bridge.onInboundMessage({ shop_id: "shop-1", conversation_id: "c1", content: "有货吗", platform_message_id: "m1" });
  assert.deepEqual(orc.calls, ["message:shop-1:c1:有货吗"]);
});

test("bridge forwards human reply to the M5 takeover input", async () => {
  const orc = makeOrchestrator();
  const bridge = new PddOrchestratorBridge(orc as never);
  await bridge.onHumanReply("shop-1", "c1");
  assert.deepEqual(orc.calls, ["takeover:shop-1:c1"]);
});

test("bridge never mutates orchestrator internals directly (public API only)", async () => {
  const orc = makeOrchestrator();
  const bridge = new PddOrchestratorBridge(orc as never);
  bridge.onConversationChange("shop-1");
  assert.deepEqual(orc.calls, ["focus:shop-1"]);
});
