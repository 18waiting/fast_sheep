import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY_HANDLERS } from "../dist/main/ipc/query-handlers.js";
import type { QueryDeps } from "../dist/main/ipc/query-handlers.js";

function makeDeps(overrides: Partial<QueryDeps> = {}): QueryDeps {
  return {
    orchestrator: { snapshot: () => ({ conversations: [] }) } as unknown as QueryDeps["orchestrator"],
    shops: { list: async () => [{ shop_id: "s1", name: "店铺1", type: "pdd", enabled: true }] } as unknown as QueryDeps["shops"],
    worker: { status: () => ({ status: "ready", worker_version: "0.0.0", protocol_version: 1 }) } as unknown as QueryDeps["worker"],
    projection: { project: () => ({ revision: 1, shop_summaries: [], worker_status: { status: "ready" }, platform_capability: "none" }) } as unknown as QueryDeps["projection"],
    revision: () => 7,
    ...overrides,
  };
}

test("desktop.bootstrap returns worker status, shops and view model", async () => {
  const handler = QUERY_HANDLERS["desktop.bootstrap"](makeDeps());
  const res = await handler();
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.revision, 7);
    assert.equal(res.data.worker_status.status, "ready");
    assert.equal(res.data.shops.length, 1);
    assert.equal(res.data.view_model.platform_capability, "none");
  }
});

test("shops.list returns the shop rows", async () => {
  const handler = QUERY_HANDLERS["shops.list"](makeDeps());
  const res = await handler();
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.shops[0].shop_id, "s1");
});

test("orchestrator.snapshot returns the workbench projection", async () => {
  const handler = QUERY_HANDLERS["orchestrator.snapshot"](makeDeps());
  const res = await handler({ shop_id: "s1" });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.revision, 1);
});

test("worker.status returns the safe worker status view", async () => {
  const handler = QUERY_HANDLERS["worker.status"](makeDeps());
  const res = await handler();
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.status, "ready");
});
