import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning, waitForPending } from "./helpers/harness.mjs";
import { RPC_ERROR_CODES } from "../dist/index.js";

test("in-flight limit rejects excess requests with backpressure (GF-RPC-011)", async () => {
  let n = 0;
  const client = await startReady({ maxInFlight: 2, requestIdFactory: () => "r" + (++n) });
  try {
    const p1 = client.request("test.hang", {});
    const p2 = client.request("test.hang", {});
    await assert.rejects(() => client.request("test.echo", {}), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.BACKPRESSURE);
    // cancel both hanging requests to clean up (system.cancel bypasses the in-flight limit)
    const e1p = p1.then(() => null, (e) => e);
    const e2p = p2.then(() => null, (e) => e);
    await client.cancelRequest("r1").catch(() => null);
    await client.cancelRequest("r2").catch(() => null);
    const e1 = await e1p;
    const e2 = await e2p;
    await waitForPending(client, 0);
    assert.equal(e1.code, "cancelled");
    assert.equal(e2.code, "cancelled");
  } finally { await stopIfRunning(client); }
});
