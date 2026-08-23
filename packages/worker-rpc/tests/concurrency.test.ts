import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning } from "./helpers/harness.mjs";

test("concurrent requests all resolve (GF-RPC-003)", async () => {
  let n = 0;
  const client = await startReady({ maxInFlight: 8, requestIdFactory: () => "r" + (++n) });
  try {
    const results = await Promise.all(["r1", "r2"].map(() => client.request("ping", {})));
    const matched = results.map((r) => (r as { request_id: string }).request_id).sort();
    assert.deepEqual(matched, ["r1", "r2"]);
  } finally { await stopIfRunning(client); }
});

test("out-of-order responses still correlate (GF-RPC-004)", async () => {
  let n = 0;
  const client = await startReady({ mode: "out-of-order", requestIdFactory: () => "r" + (++n) });
  try {
    // fake worker in out-of-order mode delays r1 so r2 answers first
    const p1 = client.request("ping", {});
    const p2 = client.request("ping", {});
    const r2 = await p2;
    const r1 = await p1;
    assert.equal((r2 as { request_id: string }).request_id, "r2");
    assert.equal((r1 as { request_id: string }).request_id, "r1");
    assert.equal((r1 as { ok: boolean }).ok, true);
    assert.equal((r2 as { ok: boolean }).ok, true);
  } finally { await stopIfRunning(client); }
});
