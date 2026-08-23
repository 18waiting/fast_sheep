import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnFakeClient, startReady, stopIfRunning } from "./helpers/harness.mjs";
import { RPC_ERROR_CODES } from "../dist/index.js";

async function withClient(fn: (client: Awaited<ReturnType<typeof startReady>>) => Promise<void>, opts: Parameters<typeof startReady>[0] = {}) {
  const client = await startReady(opts);
  try { await fn(client); } finally { await stopIfRunning(client); }
}

test("client reaches READY after worker.ready handshake", async () => {
  await withClient(async (client) => {
    assert.equal(client.state(), "READY");
    assert.equal(client.protocolVersion, 1);
  });
});

test("health() returns validated health-result", async () => {
  await withClient(async (client) => {
    const h = await client.health();
    assert.equal(h.status, "ok");
    assert.equal(h.protocol_version, 1);
    assert.ok(h.pid > 0);
    assert.ok(h.uptime_ms >= 0);
  });
});

test("startup rejects incompatible worker version (version.unsupported)", async () => {
  const client = spawnFakeClient({ mode: "bad-version", startupTimeoutMs: 3000 });
  await assert.rejects(() => client.start(), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.VERSION_UNSUPPORTED);
  await stopIfRunning(client);
});

test("startup times out when worker never becomes ready", async () => {
  const client = spawnFakeClient({ mode: "never-ready", startupTimeoutMs: 300 });
  await assert.rejects(() => client.start(), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.STARTUP_TIMEOUT);
  await stopIfRunning(client);
});
