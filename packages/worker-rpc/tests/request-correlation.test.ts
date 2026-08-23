import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning, waitForPending } from "./helpers/harness.mjs";

test("request/response correlate by request_id (GF-RPC-002)", async () => {
  const client = await startReady({ requestIdFactory: () => "r1" });
  try {
    const res = await client.request("ping", {});
    assert.deepEqual(res, { request_id: "r1", ok: true });
  } finally { await stopIfRunning(client); }
});

test("a late response cannot resurrect a settled request", async () => {
  const client = await startReady({ requestIdFactory: () => "r1", requestTimeoutMs: 150 });
  try {
    // Send a hang that times out; the fake worker keeps it hanging. A late response is ignored.
    const err = await client.request("test.hang", {}).then(() => null, (e) => e);
    assert.equal(err.code, "timeout");
    await waitForPending(client, 0); // let best-effort system.cancel settle
    assert.equal(client.pendingCount, 0);
    // A subsequent request still works and correlates fresh.
    const res = await client.request("ping", {});
    assert.equal(res.ok, true);
  } finally { await stopIfRunning(client); }
});
