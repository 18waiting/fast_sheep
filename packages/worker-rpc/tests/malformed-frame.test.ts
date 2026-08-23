import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning } from "./helpers/harness.mjs";

test("malformed line from worker is skipped and worker keeps working (GF-RPC-005)", async () => {
  const client = await startReady({ mode: "malformed-first" });
  try {
    assert.equal(client.state(), "READY");
    const res = await client.request("ping", {});
    assert.equal(res.ok, true);
  } finally { await stopIfRunning(client); }
});
