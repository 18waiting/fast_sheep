import { test } from "node:test";
import assert from "node:assert/strict";
import { OrchestratorEventBridge } from "../dist/main/events/orchestrator-event-bridge.js";
import { IPC } from "@fastwork/desktop-ipc";

function makeSource() {
  const handlers = new Map<string, Array<(payload: unknown) => void>>();
  return {
    on: (event: string, handler: (payload: unknown) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return () => {
        const l = handlers.get(event) ?? [];
        handlers.set(event, l.filter((h) => h !== handler));
      };
    },
    fire: (event: string, payload?: unknown) => {
      for (const h of handlers.get(event) ?? []) h(payload);
    },
    handlers,
  };
}

test("orchestrator event bridge forwards M5 events with revision to the renderer channel", () => {
  const source = makeSource();
  const sent: Array<{ channel: string; payload: unknown }> = [];
  let revision = 5;
  const bridge = new OrchestratorEventBridge(
    source,
    { send: (channel, payload) => sent.push({ channel, payload }) },
    () => revision,
  );
  bridge.start();
  source.fire("SuggestionReady", { shop_id: "s1" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, IPC.orchestratorEvent);
  const payload = sent[0].payload as { event: string; revision: number };
  assert.equal(payload.event, "SuggestionReady");
  assert.equal(payload.revision, 5);

  source.fire("SendCompleted", {});
  assert.equal(sent.length, 2);

  bridge.stop();
  source.fire("HumanTakeover", {});
  assert.equal(sent.length, 2, "stop() must unsubscribe all listeners");
});

test("bridge never mutates business state (send-only projection)", () => {
  const source = makeSource();
  const sent: unknown[] = [];
  const bridge = new OrchestratorEventBridge(source, { send: (_c, p) => sent.push(p) }, () => 1);
  bridge.start();
  source.fire("SendFailed", { error: "raw" });
  const payload = sent[0] as { event: string };
  assert.equal(payload.event, "SendFailed");
  bridge.stop();
});
