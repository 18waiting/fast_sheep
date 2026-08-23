import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnFakeClient, startReady, stopIfRunning } from "./helpers/harness.mjs";
import { RPC_ERROR_CODES } from "../dist/index.js";

test("start rejects incompatible worker version (GF-RPC-006)", async () => {
  const client = spawnFakeClient({ mode: "bad-version", startupTimeoutMs: 3000 });
  await assert.rejects(() => client.start(), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.VERSION_UNSUPPORTED);
  await stopIfRunning(client);
});

test("unknown method returns method.unknown without crashing (GF-RPC-007)", async () => {
  const client = await startReady();
  try {
    await assert.rejects(() => client.request("no_such_method", {}), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.METHOD_NOT_FOUND);
    // worker still alive and usable
    const res = await client.request("ping", {});
    assert.equal(res.ok, true);
  } finally { await stopIfRunning(client); }
});
