import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning } from "./helpers/harness.mjs";

test("events carry correlation_id and reach subscribers (GF-RPC-001 event surface)", async () => {
  let n = 0;
  const client = await startReady({ requestIdFactory: () => "r" + (++n) });
  try {
    const events: Array<{ event: string; payload: unknown; correlation_id?: string }> = [];
    const unsub = client.subscribeEvents((ev) => events.push(ev));
    await client.request("test.emit_event", { hello: "world" }, { context: { shop_id: "s1", correlation_id: "corr-1" } });
    await new Promise((r) => setTimeout(r, 50));
    const ev = events.find((e) => e.event === "test.event");
    assert.ok(ev);
    assert.equal(ev.correlation_id, "corr-1");
    assert.deepEqual((ev.payload as { echo: unknown }).echo, { hello: "world" });
    unsub();
  } finally { await stopIfRunning(client); }
});

test("a throwing subscriber does not break other subscribers or the transport", async () => {
  const client = await startReady();
  try {
    const seen: string[] = [];
    client.subscribeEvents(() => { throw new Error("bad subscriber"); });
    client.subscribeEvents((ev) => seen.push(ev.event));
    await client.request("test.emit_event", {});
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(seen.includes("test.event"));
    const res = await client.request("ping", {});
    assert.equal(res.ok, true);
  } finally { await stopIfRunning(client); }
});
