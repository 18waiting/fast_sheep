import { test } from "node:test";
import assert from "node:assert/strict";
import { createSubscriptions } from "../dist/preload/subscriptions.js";
import { IPC } from "@fastwork/desktop-ipc";

test("subscriptions subscribe to the exact event channels and return unsubscribe", () => {
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  const subs = createSubscriptions((channel, listener) => {
    subscribed.push(channel);
    return () => unsubscribed.push(channel);
  });

  const u1 = subs.onOrchestratorEvent(() => {});
  const u2 = subs.onWorkerStatusChanged(() => {});
  const u3 = subs.onShopsChanged(() => {});
  assert.deepEqual(subscribed, [IPC.orchestratorEvent, IPC.workerStatusChanged, IPC.shopsChanged]);

  u1(); u2(); u3();
  assert.deepEqual(unsubscribed, [IPC.orchestratorEvent, IPC.workerStatusChanged, IPC.shopsChanged]);
});

test("subscription handlers receive normalized payloads", () => {
  const listeners: Array<(payload: unknown) => void> = [];
  const subs = createSubscriptions((_channel, listener) => {
    listeners.push(listener);
    return () => {};
  });
  const evs: unknown[] = [];
  subs.onOrchestratorEvent((ev) => evs.push(ev));
  listeners[0](null, { event: "SendStarted", revision: 4 });
  assert.deepEqual(evs, [{ event: "SendStarted", revision: 4 }]);

  const statuses: unknown[] = [];
  subs.onWorkerStatusChanged((s) => statuses.push(s));
  listeners[1](null, { status: "ready" });
  assert.deepEqual(statuses, [{ status: "ready" }]);

  let shopNotified = 0;
  subs.onShopsChanged(() => shopNotified++);
  listeners[2](null, undefined);
  assert.equal(shopNotified, 1);
});
