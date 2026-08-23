import { test } from "node:test";
import assert from "node:assert/strict";

import { validateBootstrapState, validateWorkerStatus, validateWorkbenchViewModel, validateOrchestratorEvent } from "../dist/index.js";

test("bootstrap/worker/view-model/event schemas validate valid data", () => {
  const worker = { status: "ready", worker_version: "0.0.0", protocol_version: 1 };
  assert.ok(validateWorkerStatus(worker).ok);
  const vm = { revision: 1, shop_summaries: [], worker_status: worker, platform_capability: "none" };
  assert.ok(validateWorkbenchViewModel(vm).ok);
  const bs = { revision: 1, worker_status: worker, shops: [], view_model: vm };
  assert.ok(validateBootstrapState(bs).ok);
  assert.ok(validateOrchestratorEvent({ event: "SuggestionReady", revision: 1 }).ok);
});

test("invalid data fails", () => {
  assert.ok(!validateWorkerStatus({ status: "nope" }).ok);
  assert.ok(!validateWorkbenchViewModel({ revision: 1, shop_summaries: [] }).ok);
});
