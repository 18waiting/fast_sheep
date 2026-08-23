// M6 workbench projection verification (clean-room, deterministic).
// Projects deterministic M5-state fixtures through WorkbenchProjectionService and
// asserts renderer-safe fields. No screenshots/pixel comparison.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const { WorkbenchProjectionService } = await import(pathToFileURL(join(ROOT, "apps", "desktop", "dist", "main", "services", "workbench-projection-service.js")).href);
const { reduceEvent } = await import(pathToFileURL(join(ROOT, "apps", "desktop", "dist", "renderer", "state", "event-reducer.js")).href);
const { EMPTY_UI_STATE } = await import(pathToFileURL(join(ROOT, "apps", "desktop", "dist", "renderer", "state", "view-model.js")).href);

const failures = [];
const scenarioResults = {};
function scenario(name, source, asserts) {
  const vm = new WorkbenchProjectionService(source).project();
  const ok = asserts(vm);
  scenarioResults[name] = ok ? "PASS" : "FAIL";
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) failures.push(name);
  return vm;
}

const base = (overrides = {}) => ({
  revision: () => 10,
  shops: () => [
    { shop_id: "s1", name: "店铺1", type: "pdd", enabled: true },
    { shop_id: "s2", name: "店铺2", type: "doudian", enabled: true },
  ],
  selectedShopId: () => "s1",
  conversation: () => ({ conversation_id: "c1", shop_id: "s1", state: "suggestion_pending", buyer: "测试买家" }),
  suggestion: () => ({ reply: "亲,有的哦~", generation: 1, status: "pending" }),
  mode: () => "human_review",
  countdown: () => null,
  sendStatus: () => null,
  takeoverStatus: () => null,
  workerStatus: () => ({ status: "ready" }),
  lastError: () => null,
  ...overrides,
});

const scenarios = [];

scenarios.push(scenario("human_review", base(), (vm) =>
  vm.mode === "human_review" && vm.revision === 10 && vm.platform_capability === "none" && vm.suggestion?.status === "pending"));

scenarios.push(scenario("full_auto", base({ mode: () => "full_auto" }), (vm) => vm.mode === "full_auto"));

scenarios.push(scenario("countdown", base({ countdown: () => ({ enabled: true, remaining_ticks: 5, tick_ms: 1000 }) }), (vm) =>
  vm.countdown?.enabled === true && vm.countdown.remaining_ticks === 5 && vm.countdown.tick_ms === 1000));

scenarios.push(scenario("manual_send", base({ sendStatus: () => "sending" }), (vm) =>
  vm.send_status === "sending" && vm.suggestion !== undefined));

scenarios.push(scenario("no_save", base({ sendStatus: () => "sent" }), (vm) => {
  // NO_SAVE must never project knowledge-mutation/feedback class data.
  const json = JSON.stringify(vm);
  return vm.send_status === "sent" && !json.includes("feedback") && !json.includes("knowledge");
}));

scenarios.push(scenario("cancel", base({ suggestion: () => null, sendStatus: () => null }), (vm) =>
  vm.suggestion === undefined && vm.send_status === undefined));

scenarios.push(scenario("send_started", base({ sendStatus: () => "sending" }), (vm) => vm.send_status === "sending"));

scenarios.push(scenario("send_completed", base({ sendStatus: () => "sent" }), (vm) => vm.send_status === "sent"));

scenarios.push(scenario("send_failed", base({ sendStatus: () => "failed", lastError: () => "发送失败" }), (vm) =>
  vm.send_status === "failed" && vm.last_error === "发送失败"));

scenarios.push(scenario("takeover", base({ takeoverStatus: () => "human_takeover" }), (vm) => vm.takeover_status === "human_takeover"));

scenarios.push(scenario("worker_restarting", base({ workerStatus: () => ({ status: "restarting" }) }), (vm) =>
  vm.worker_status.status === "restarting"));

scenarios.push(scenario("shop_switch", base({ selectedShopId: () => "s2", conversation: () => ({ conversation_id: "c2", shop_id: "s2", state: "idle" }) }), (vm) =>
  vm.selected_shop_id === "s2" && vm.conversation?.conversation_id === "c2"));

// stale_event: renderer must ignore an older-revision event for the current shop.
{
  const vm = new WorkbenchProjectionService(base()).project();
  const state = { ...EMPTY_UI_STATE, viewModel: vm, selectedShopId: "s1" };
  const out = reduceEvent(state, { event: "SendStarted", revision: 9 });
  const ok = out.kind === "ignored_stale";
  console.log((ok ? "PASS " : "FAIL ") + "stale_event");
  if (!ok) failures.push("stale_event");
}

scenarioResults.stale_event = failures.includes("stale_event") ? "FAIL" : "PASS";
const report = {
  scenarios: scenarioResults,
  all_passed: failures.length === 0,
};
writeFileSync(join(ROOT, "reports", "m6-workbench-projection-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");

if (failures.length > 0) {
  console.error("M6 workbench projection verification FAILED: " + failures.join(", "));
  process.exit(1);
}
console.log("M6 workbench projection verification PASS (13 scenarios).");
