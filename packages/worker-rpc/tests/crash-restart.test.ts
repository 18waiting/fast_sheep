import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnFakeClient, waitForState, stopIfRunning } from "./helpers/harness.mjs";
import { RPC_ERROR_CODES } from "../dist/index.js";

const noSleep = async () => {};

test("worker crash fails pending requests and restarts (GF-RPC-010)", async () => {
  let n = 0;
  const client = spawnFakeClient({
    requestIdFactory: () => "r" + (++n),
    restart: { enabled: true, max_attempts: 2, initial_backoff_ms: 1, max_backoff_ms: 10 },
    sleepMs: noSleep,
  });
  await client.start();
  try {
    const hangErr = client.request("test.hang", {}).then(() => null, (e) => e);
    await new Promise((r) => setTimeout(r, 30));
    const crashErr = await client.request("test.crash", {}).then(() => null, (e) => e);
    assert.equal(crashErr.code, RPC_ERROR_CODES.WORKER_CRASHED);
    const pendingErr = await hangErr;
    assert.equal(pendingErr.code, RPC_ERROR_CODES.WORKER_CRASHED);
    assert.equal(client.pendingCount, 0);
    await waitForState(client, "READY", 4000); // auto-restart completes ready handshake
    const res = await client.request("ping", {});
    assert.equal(res.ok, true);
  } finally { await stopIfRunning(client); }
});

test("restart does not auto-replay old requests", async () => {
  let n = 0;
  const client = spawnFakeClient({ requestIdFactory: () => "r" + (++n), restart: { enabled: true, max_attempts: 2, initial_backoff_ms: 1, max_backoff_ms: 10 }, sleepMs: noSleep });
  await client.start();
  try {
    const oldErr = client.request("test.hang", {}).then(() => null, (e) => e);
    await new Promise((r) => setTimeout(r, 30));
    await client.request("test.crash", {}).then(() => null, (e) => e);
    const err = await oldErr;
    assert.equal(err.code, RPC_ERROR_CODES.WORKER_CRASHED); // old request failed, NOT replayed
    await waitForState(client, "READY", 4000);
    const res = await client.request("test.echo", { tag: "new" });
    assert.deepEqual(res, { tag: "new" });
  } finally { await stopIfRunning(client); }
});
