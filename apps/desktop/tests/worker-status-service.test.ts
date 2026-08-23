import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkerStatusService } from "../dist/main/services/worker-status-service.js";
import type { WorkerStatusSource } from "../dist/main/services/worker-status-service.js";

test("worker status service projects safe lifecycle statuses", () => {
  const s = new WorkerStatusService({ state: () => "restarting", version: () => "1.2.3", protocolVersion: () => 1 });
  const view = s.status();
  assert.equal(view.status, "restarting");
  assert.equal(view.worker_version, "1.2.3");
  assert.equal(view.protocol_version, 1);
});

test("worker status never exposes raw paths/env/stack — last_error is truncated", () => {
  const s = new WorkerStatusService({
    state: () => "error",
    lastError: () => "Traceback: C:/python/env/lib/site-packages/x.py " + "x".repeat(500),
  } as WorkerStatusSource);
  const view = s.status();
  assert.equal(view.status, "error");
  assert.ok(view.last_error!.length <= 200);
  assert.ok(!("env" in view));
  assert.ok(!("python_path" in view));
});

test("worker status omits optional fields when absent", () => {
  const s = new WorkerStatusService({ state: () => "ready" });
  const view = s.status();
  assert.equal(view.status, "ready");
  assert.equal(view.worker_version, undefined);
  assert.equal(view.protocol_version, undefined);
});
