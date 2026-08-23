import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning } from "./helpers/harness.mjs";

test("stderr diagnostics do not appear on the protocol channel", async () => {
  const client = await startReady({ mode: "stderr-noise" });
  try {
    assert.equal(client.state(), "READY");
    const res = await client.request("test.echo", { ok: 1 });
    assert.deepEqual(res, { ok: 1 });
  } finally { await stopIfRunning(client); }
});
