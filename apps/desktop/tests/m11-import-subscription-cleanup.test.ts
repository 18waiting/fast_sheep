import { test } from "node:test";
import assert from "node:assert/strict";
import { createSubscriptions, type SubscribeFn } from "../dist/preload/subscriptions.js";

test("legacy import subscription returns unsubscribe and removes the listener", () => {
  const removed: string[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const subscribe: SubscribeFn = (channel, listener) => {
    const arr = listeners.get(channel) ?? [];
    arr.push(listener);
    listeners.set(channel, arr);
    return () => {
      const cur = listeners.get(channel) ?? [];
      listeners.set(channel, cur.filter((l) => l !== listener));
      removed.push(channel);
    };
  };
  const subs = createSubscriptions(subscribe);
  const unsub = subs.onLegacyImportChanged(() => {});
  assert.equal(listeners.size, 1);
  unsub();
  assert.equal(removed.length, 1);
  for (const [, arr] of listeners) assert.equal(arr.length, 0);
});
