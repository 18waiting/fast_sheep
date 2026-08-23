import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, spawnFakeClient } from "./helpers/harness.mjs";

test("client.stop() performs graceful shutdown and ends STOPPED", async () => {
  const client = await startReady();
  const res = await client.request("ping", {});
  assert.equal(res.ok, true);
  await client.stop();
  assert.equal(client.state(), "STOPPED");
});

test("requests after stop are rejected with rpc.shutdown", async () => {
  const client = await startReady();
  await client.stop();
  await assert.rejects(() => client.request("ping", {}), (e: unknown) => (e as { code?: string }).code === "shutdown");
});

test("force-kill fallback terminates a worker that ignores graceful shutdown", async () => {
  const client = spawnFakeClient({ mode: "ignore-shutdown", gracefulShutdownTimeoutMs: 300 });
  await client.start();
  await client.stop();
  assert.equal(client.state(), "STOPPED");
});
