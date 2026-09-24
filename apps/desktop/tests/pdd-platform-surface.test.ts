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
import { PLATFORM_CAPABILITY_QUALIFIER, capabilityPresentationClass, capabilityPresentationLabel } from "../dist/renderer/components/platform-surface.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACE_SRC = join(HERE, "..", "src", "renderer", "components", "platform-surface.ts");
const SURFACE_DIST = join(HERE, "..", "dist", "renderer", "components", "platform-surface.js");
const STYLES_SRC = join(HERE, "..", "src", "renderer", "styles.css");

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
  store.applyViewModel(vm);
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
  const src = readFileSync(SURFACE_SRC, "utf-8");
  for (const token of ["querySelector", "sendText", "manualSend", "webContents", "data-fw-pdd-message"]) {
    assert.ok(!src.includes(token), "platform-surface must not " + token);
  }
  assert.ok(src.includes("ResizeObserver"), "surface reports bounds via ResizeObserver");
});

test("platform-surface browser graph has no runtime PDD package import", () => {
  const src = readFileSync(SURFACE_SRC, "utf-8");
  const dist = readFileSync(SURFACE_DIST, "utf-8");
  assert.ok(!src.includes("@fastwork/platform-pdd"), "renderer source must not import the workspace PDD package at runtime");
  assert.ok(!dist.includes("@fastwork/platform-pdd"), "emitted renderer module must not retain the bare PDD package specifier");
  assert.ok(!src.includes("PDD_CAPABILITY_DESCRIPTORS"), "renderer must not duplicate or import the canonical capability registry");
});

test("normal renderer application module graph imports without unresolved runtime packages", async () => {
  await assert.doesNotReject(import("../dist/renderer/app.js"));
});

test("capability chips present declaration state without false support semantics", () => {
  const src = readFileSync(SURFACE_SRC, "utf-8");
  const styles = readFileSync(STYLES_SRC, "utf-8");
  assert.equal(capabilityPresentationLabel("pdd", "send_text", true), "已声明");
  assert.equal(capabilityPresentationLabel("pdd", "desktop_helper", false), "未声明");
  assert.equal(capabilityPresentationClass("pdd", "send_text", true), "cap-chip declared");
  assert.equal(capabilityPresentationClass("pdd", "desktop_helper", false), "cap-chip undeclared");
  assert.ok(!src.includes("data-supported"), "capability chips must not expose a support-state attribute");
  assert.ok(!styles.includes(".cap-chip.supported") && !styles.includes(".cap-chip.unsupported"), "capability chips must not use support-state visual classes");
  assert.ok(styles.includes(".cap-chip.declared") && styles.includes(".cap-chip.undeclared"), "capability chips must use neutral declaration-state classes");
});

test("capability qualifier distinguishes projection, platform support, readiness, and authorization", () => {
  assert.equal(PLATFORM_CAPABILITY_QUALIFIER, "此处仅显示本地兼容能力声明，不代表平台支持、生产就绪或操作授权。");
  assert.ok(PLATFORM_CAPABILITY_QUALIFIER.includes("兼容能力声明"));
  assert.ok(PLATFORM_CAPABILITY_QUALIFIER.includes("平台支持"));
  assert.ok(PLATFORM_CAPABILITY_QUALIFIER.includes("生产就绪"));
  assert.ok(PLATFORM_CAPABILITY_QUALIFIER.includes("操作授权"));
});

test("canonical PDD capability registry remains Main-owned and Renderer consumes projected booleans", () => {
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.receive_text.maturity, "OBSERVATION_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.send_text.maturity, "LOCAL_CONTRACT_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.send_image.maturity, "SYNTHETIC_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.conversation_selection.maturity, "OBSERVATION_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.product_context.maturity, "SYNTHETIC_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.order_context.maturity, "SYNTHETIC_ONLY");
  assert.equal(PDD_CAPABILITY_DESCRIPTORS.send_text.declared, true);
  assert.deepEqual(capabilitiesFor("pdd"), PDD_CAPABILITIES);
});

test("platformIsReady helper reflects READY status", () => {
  assert.equal(platformIsReady({ activeShopId: "s1", platformType: "pdd", sessionStatus: "READY", viewVisible: true, lastSafeError: null }), true);
  assert.equal(platformIsReady({ ...EMPTY_PLATFORM_VIEW_STATE, sessionStatus: "LOGIN_REQUIRED" }), false);
});
