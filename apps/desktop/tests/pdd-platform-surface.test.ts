import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import { EMPTY_PLATFORM_VIEW_STATE } from "../dist/renderer/state/platform-view-state.js";
import { platformIsReady } from "../dist/renderer/state/platform-view-state.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDD_CAPABILITY_DESCRIPTORS } from "@fastwork/platform-pdd";
import { PDD_CAPABILITIES } from "@fastwork/platform-pdd";
import { capabilitiesFor } from "../dist/main/platforms/platform-capability-registry.js";
import { capabilityPresentationClass, capabilityPresentationLabel } from "../dist/renderer/components/platform-surface.js";

const vm = {
  revision: 1,
  shop_summaries: [{ shop_id: "s1", name: "店铺1", type: "pdd", enabled: true }],
  selected_shop_id: "s1",
  conversation: { conversation_id: "c1", shop_id: "s1", state: "idle" },
  mode: "human_review",
  worker_status: { status: "ready" },
  platform_capability: "pdd",
} as never;

function makeApi(viewModel = vm) {
  const calls: string[] = [];
  const api: WorkbenchApiLike = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: viewModel } }),
    getSnapshot: async () => ({ ok: true, data: viewModel }),
    setMode: async () => ({ ok: true, data: { ok: true } }),
    manualSend: async () => ({ ok: true, data: { ok: true } }),
    noSaveSend: async () => ({ ok: true, data: { ok: true } }),
    cancel: async () => ({ ok: true, data: { ok: true } }),
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s1", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => { calls.push("activate"); return { ok: true, data: { ok: true } }; },
    setPlatformViewBounds: async () => { calls.push("bounds"); return { ok: true, data: { ok: true } }; },
    reloadPlatform: async () => { calls.push("reload"); return { ok: true, data: { ok: true } }; },
    onPlatformStatusChanged: () => () => {},
  };
  return { api, calls };
}

test("selecting a PDD shop activates the platform session and loads its status", async () => {
  const { api, calls } = makeApi();
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.selectShop("s1");
  assert.ok(calls.includes("activate"));
  assert.equal(store.getState().platform.platformType, "pdd");
  assert.equal(store.getState().platform.sessionStatus, "READY");
});

test("applyPlatformStatusChanged updates the presentation-only projection", () => {
  const { api } = makeApi();
  const store = new WorkbenchStore(api);
  store.applyPlatformStatusChanged({ shop_id: "s1", session_status: "LOGIN_REQUIRED", revision: 2 });
  assert.equal(store.getState().platform.sessionStatus, "LOGIN_REQUIRED");
});

test("non-PDD shop resets the platform projection", async () => {
  const nonPddVm = {
    revision: 1,
    shop_summaries: [{ shop_id: "s9", name: "店铺J", type: "jd", enabled: true }],
    selected_shop_id: "s9",
    conversation: { conversation_id: "c9", shop_id: "s9", state: "idle" },
    mode: "human_review",
    worker_status: { status: "ready" },
    platform_capability: "none",
  } as never;
  const { api } = makeApi(nonPddVm);
  const store = new WorkbenchStore(api);
  await store.boot();
  store.applyPlatformStatusChanged({ shop_id: "s9", session_status: "READY", revision: 2 });
  await store.selectShop("s9");
  assert.deepEqual(store.getState().platform, EMPTY_PLATFORM_VIEW_STATE);
});

test("platform-surface component never reads PDD DOM or sends messages", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "platform-surface.ts"), "utf-8");
  for (const token of ["querySelector", "sendText", "manualSend", "webContents", "data-fw-pdd-message"]) {
    assert.ok(!src.includes(token), "platform-surface must not " + token);
  }
  assert.ok(src.includes("ResizeObserver"), "surface reports bounds via ResizeObserver");
});

test("PDD capability projection consumes canonical maturity descriptors", () => {
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.receive_text.maturity, "OBSERVATION_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.send_text.maturity, "LOCAL_CONTRACT_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.send_image.maturity, "SYNTHETIC_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.conversation_selection.maturity, "OBSERVATION_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.product_context.maturity, "SYNTHETIC_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.order_context.maturity, "SYNTHETIC_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.send_text.declared, true);
  assert.deepEqual(capabilitiesFor("pdd"), PDD_CAPABILITIES);
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "platform-surface.ts"), "utf-8");
  assert.ok(src.includes("PDD_CAPABILITY_DESCRIPTORS"));
  assert.equal(capabilityPresentationLabel("pdd", "receive_text", true), "观察能力");
  assert.equal(capabilityPresentationLabel("pdd", "send_text", true), "本地契约");
  assert.equal(capabilityPresentationLabel("pdd", "send_image", true), "合成测试");
  assert.equal(capabilityPresentationLabel("pdd", "desktop_helper", false), "未实现");
  assert.equal(capabilityPresentationLabel("jd", "send_text", true), "支持");
  assert.equal(capabilityPresentationLabel("pdd", "unknown", true), "支持");
  assert.equal(capabilityPresentationClass("pdd", "send_text", true), "cap-chip unsupported");
  assert.equal(capabilityPresentationClass("jd", "send_text", true), "cap-chip supported");
});

test("platformIsReady helper reflects READY status", () => {
  assert.equal(platformIsReady({ activeShopId: "s1", platformType: "pdd", sessionStatus: "READY", viewVisible: true, lastSafeError: null }), true);
  assert.equal(platformIsReady({ ...EMPTY_PLATFORM_VIEW_STATE, sessionStatus: "LOGIN_REQUIRED" }), false);
});
