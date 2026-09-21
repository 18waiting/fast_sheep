// SHEEP-301: controlled decoded-event capture entry (version-managed, default OFF).
//
// These tests pin the ENTRY contract only: the single controlled call order
// (start -> drain* -> stop), the Main-owned switch, and the refusal behaviour when the switch is
// off or the lifecycle is wrong. They never prove anything about page events or canonical mapping -
// that is what the service-level / application-level runs are for.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createControlledDecodedEventCaptureEntry,
  CONTROLLED_CAPTURE_ALREADY_RUNNING,
  CONTROLLED_CAPTURE_DISABLED,
  CONTROLLED_CAPTURE_NOT_RUNNING,
  CONTROLLED_CAPTURE_NOT_STARTED,
  CONTROLLED_CAPTURE_STOPPED,
} from "../dist/main/controlled/decoded-event-capture-entry.js";

const emptyDrain = (overrides = {}) => ({
  ok: true, drained: 0, ingested: 0, duplicates: 0, remaining: 0, dropped: 0, gap: false, diagnostics: [], ...overrides,
});

function fakePlatform(overrides = {}) {
  const calls = { start: 0, drain: 0, stop: 0 };
  const draining = overrides.draining ?? [];
  return {
    calls,
    startDecodedEventCapture: async () => { calls.start += 1; return overrides.startResult ?? { ok: true }; },
    drainDecodedEvents: async () => {
      calls.drain += 1;
      return draining.length > 0 ? draining.shift() : emptyDrain();
    },
    stopDecodedEventCapture: async () => { calls.stop += 1; return overrides.stopResult ?? { ok: true }; },
  };
}

test("controlled entry: DISABLED is inert - no platform call at all", async () => {
  const platform = fakePlatform();
  const entry = createControlledDecodedEventCaptureEntry({ enabled: false, shopId: "shop-1", platform });
  assert.equal(entry.state(), "NOT_STARTED");
  assert.equal((await entry.start()).reason, CONTROLLED_CAPTURE_DISABLED);
  const drained = await entry.drain();
  assert.equal(drained.ok, false);
  assert.equal(drained.reason, CONTROLLED_CAPTURE_DISABLED);
  assert.equal(drained.drained, 0);
  assert.equal((await entry.stop()).reason, CONTROLLED_CAPTURE_DISABLED);
  assert.deepEqual(platform.calls, { start: 0, drain: 0, stop: 0 }, "a disabled entry never touches the service");
  const summary = entry.summary();
  assert.equal(summary.enabled, false);
  assert.equal(summary.state, "NOT_STARTED");
  assert.equal(summary.refusals.length, 3);
});

test("controlled entry: the call order is enforced (start -> drain -> stop)", async () => {
  const platform = fakePlatform({ draining: [emptyDrain({ drained: 2, ingested: 2 })] });
  const entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: "shop-1", platform });

  const beforeStart = await entry.drain();
  assert.equal(beforeStart.reason, CONTROLLED_CAPTURE_NOT_STARTED);
  assert.equal(platform.calls.drain, 0, "a drain before start never reaches the service");

  assert.equal((await entry.start()).ok, true);
  assert.equal(entry.state(), "RUNNING");
  assert.equal((await entry.start()).reason, CONTROLLED_CAPTURE_ALREADY_RUNNING, "start is not repeatable");
  assert.equal(platform.calls.start, 1);

  const drained = await entry.drain();
  assert.equal(drained.drained, 2);
  assert.equal((await entry.stop()).ok, true);
  assert.equal(entry.state(), "STOPPED");

  const afterStop = await entry.drain();
  assert.equal(afterStop.reason, CONTROLLED_CAPTURE_NOT_RUNNING);
  assert.equal((await entry.stop()).reason, CONTROLLED_CAPTURE_NOT_RUNNING, "stop is not repeatable");
  assert.equal(platform.calls.drain, 1, "no drain reached the service after the stop");
  assert.equal(platform.calls.stop, 1);
});

test("controlled entry: counters accumulate per drain and a refused batch is never retried", async () => {
  const platform = fakePlatform({
    draining: [
      emptyDrain({ drained: 3, ingested: 3 }),
      emptyDrain({ ok: false, reason: "MAIN_ADMISSION_DENIED:REVOKED", diagnostics: ["ADMISSION_REVOKED_DURING_DRAIN"] }),
      emptyDrain({ drained: 3, duplicates: 3 }),
    ],
  });
  const entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: "shop-1", platform });
  await entry.start();
  assert.equal((await entry.drain()).ingested, 3);
  const refused = await entry.drain();
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "MAIN_ADMISSION_DENIED:REVOKED");
  assert.equal((await entry.drain()).duplicates, 3);

  const summary = entry.summary();
  assert.equal(summary.drainCalls, 3);
  assert.equal(summary.drained, 6, "a refused batch contributes nothing to the counters");
  assert.equal(summary.ingested, 3);
  assert.equal(summary.duplicates, 3);
  assert.deepEqual(summary.refusals, [{ stage: "drain", reason: "MAIN_ADMISSION_DENIED:REVOKED" }]);
  assert.equal(platform.calls.drain, 3, "the refused batch is not replayed");
});

test("controlled entry: a failed start is terminal for the entry (no silent restart)", async () => {
  const platform = fakePlatform({ startResult: { ok: false, reason: "ADAPTER_DISABLED" } });
  const entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: "shop-1", platform });
  const started = await entry.start();
  assert.equal(started.ok, false);
  assert.equal(started.reason, "ADAPTER_DISABLED");
  assert.equal(entry.state(), "FAILED");
  assert.equal((await entry.drain()).reason, CONTROLLED_CAPTURE_NOT_RUNNING);
  assert.equal((await entry.stop()).reason, CONTROLLED_CAPTURE_NOT_RUNNING);
  assert.equal(platform.calls.start, 1, "a failed start is not retried");
  assert.equal(platform.calls.drain, 0);
});

test("controlled entry: a STOPPED capture cannot be restarted through the same entry", async () => {
  const platform = fakePlatform({ draining: [emptyDrain({ drained: 1, ingested: 1 })] });
  const entry = createControlledDecodedEventCaptureEntry({ enabled: true, shopId: "shop-1", platform });
  assert.equal((await entry.start()).ok, true);
  assert.equal((await entry.drain()).ingested, 1);
  assert.equal((await entry.stop()).ok, true);

  // The terminated observation object is terminal: no silent restart through the same entry.
  const restart = await entry.start();
  assert.equal(restart.ok, false);
  assert.equal(restart.reason, CONTROLLED_CAPTURE_STOPPED);
  assert.equal(entry.state(), "STOPPED");
  assert.equal(platform.calls.start, 1, "the terminated entry never calls start again");
  assert.equal(platform.calls.drain, 1, "and never drains again");
  assert.equal(platform.calls.stop, 1, "and never stops again");
  const summary = entry.summary();
  assert.deepEqual(summary.refusals, [{ stage: "start", reason: CONTROLLED_CAPTURE_STOPPED }]);
  assert.equal(summary.drained, 1);
});

test("controlled page transport: rebinding an existing target is refused at the boundary", async () => {
  // The transport must refuse a target rebind BEFORE any connection: no CDP fetch, no attach.
  const { openControlledPage } = await import("../dist/main/controlled/cdp-page-transport.js");
  await assert.rejects(
    () => openControlledPage({ cdpBaseUrl: "http://127.0.0.1:1", url: "https://example.invalid/", reuseTargetId: "EXISTING-TARGET" }),
    (error) => String(error && error.message) === "CDP_TARGET_REBIND_NOT_SUPPORTED",
  );
});
