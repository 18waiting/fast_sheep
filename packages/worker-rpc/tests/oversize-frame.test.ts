import { test } from "node:test";
import assert from "node:assert/strict";
import { startReady, stopIfRunning } from "./helpers/harness.mjs";
import { RPC_ERROR_CODES } from "../dist/index.js";

test("oversized request is rejected client-side with payload.oversize (GF-RPC-012)", async () => {
  const client = await startReady({ maxFrameBytes: 256 });
  try {
    await assert.rejects(() => client.request("test.echo", { data: "x".repeat(1024) }), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.FRAME_TOO_LARGE);
    assert.equal(client.pendingCount, 0);
  } finally { await stopIfRunning(client); }
});

test("oversized worker frame is detected and does not break the client", async () => {
  const client = await startReady({ mode: "oversize-first", maxFrameBytes: 1024 });
  try {
    assert.equal(client.state(), "READY");
    const res = await client.request("ping", {});
    assert.equal(res.ok, true);
  } finally { await stopIfRunning(client); }
});
