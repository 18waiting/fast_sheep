import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning, waitForPending } from "./helpers/harness.mjs";

test("request timeout rejects locally with rpc.timeout (GF-RPC-008)", async () => {
  let n = 0;
  const client = await startReady({ requestIdFactory: () => "r" + (++n), requestTimeoutMs: 200 });
  try {
    const req = client.request("test.hang", {}).then(() => null, (e) => e);
    const err = await req;
    assert.equal(err.code, "timeout");
    assert.equal(err.category, "timeout");
    assert.equal(err.retryable, true);
    await waitForPending(client, 0); // registry leak-free after timeout (best-effort cancel settles)
  } finally { await stopIfRunning(client); }
});

test("system.cancel cancels a hanging request (GF-RPC-009)", async () => {
  let n = 0;
  const client = await startReady({ requestIdFactory: () => "r" + (++n) });
  try {
    const hangErr = client.request("test.hang", {}).then(() => null, (e) => e);
    await new Promise((r) => setTimeout(r, 50));
    const cancelResult = await client.cancelRequest("r1");
    assert.equal(cancelResult.cancelled, true);
    const err = await hangErr;
    assert.equal(err.code, "cancelled");
    await waitForPending(client, 0);
  } finally { await stopIfRunning(client); }
});

test("AbortSignal cancels an in-flight request", async () => {
  let n = 0;
  const client = await startReady({ requestIdFactory: () => "r" + (++n) });
  try {
    const ac = new AbortController();
    const hangErr = client.request("test.hang", {}, { signal: ac.signal }).then(() => null, (e) => e);
    await new Promise((r) => setTimeout(r, 50));
    ac.abort();
    const err = await hangErr;
    assert.equal(err.code, "cancelled");
    await waitForPending(client, 0);
  } finally { await stopIfRunning(client); }
});
