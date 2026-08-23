import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchProjectionService } from "../dist/main/services/workbench-projection-service.js";
import type { ProjectionSource } from "../dist/main/services/workbench-projection-service.js";
import type { WorkerStatusView } from "@fastwork/desktop-ipc";

function makeSource(overrides: Partial<ProjectionSource> = {}): ProjectionSource {
  return {
    revision: () => 3,
    shops: () => [{ shop_id: "s1", name: "店铺1", type: "pdd", enabled: true }],
    selectedShopId: () => "s1",
    conversation: () => ({ conversation_id: "c1", shop_id: "s1", state: "suggestion_pending", buyer: "测试买家" }),
    suggestion: () => ({ reply: "亲,有的哦~", generation: 1, status: "pending" }),
    mode: () => "human_review",
    countdown: () => ({ enabled: true, remaining_ticks: 5, tick_ms: 1000 }),
    sendStatus: () => null,
    takeoverStatus: () => null,
    workerStatus: () => ({ status: "ready" } as WorkerStatusView),
    lastError: () => null,
    ...overrides,
  };
}

test("projection includes only renderer-safe fields", () => {
  const p = new WorkbenchProjectionService(makeSource()).project();
  assert.equal(p.revision, 3);
  assert.equal(p.platform_capability, "none");
  assert.equal(p.selected_shop_id, "s1");
  assert.equal(p.suggestion?.reply, "亲,有的哦~");
  assert.equal(p.mode, "human_review");
  assert.equal(p.countdown?.remaining_ticks, 5);
  assert.equal(p.worker_status.status, "ready");
});

test("projection never includes internal orchestrator objects or secrets", () => {
  const source = makeSource();
  const project = new WorkbenchProjectionService(source);
  const vm = project.project();
  const json = JSON.stringify(vm);
  for (const forbidden of ["credential", "api_key", "secret", "token_value", "decision", "conversations", "python_path", "stderr"]) {
    assert.ok(!json.includes(forbidden), "must not expose: " + forbidden);
  }
});

test("empty optional fields are omitted (no null dumps)", () => {
  const vm = new WorkbenchProjectionService(
    makeSource({ conversation: () => null, suggestion: () => null, countdown: () => null, sendStatus: () => null, takeoverStatus: () => null, lastError: () => null }),
  ).project();
  assert.equal(vm.conversation, undefined);
  assert.equal(vm.suggestion, undefined);
  assert.equal(vm.countdown, undefined);
  assert.equal(vm.send_status, undefined);
  assert.equal(vm.takeover_status, undefined);
  assert.equal(vm.last_error, undefined);
});

test("last_error is sanitized/truncated to 200 chars", () => {
  const vm = new WorkbenchProjectionService(makeSource({ lastError: () => "E".repeat(500) })).project();
  assert.ok(vm.last_error!.length <= 200);
});
