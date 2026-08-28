import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const vm = {
  revision: 1,
  shop_summaries: [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }],
  selected_shop_id: "s1",
  conversation: { conversation_id: "c1", shop_id: "s1", state: "suggestion_pending" },
  suggestion: { reply: "r", generation: 1, status: "pending" },
  mode: "human_review",
  countdown: null,
  worker_status: { status: "ready" },
  platform_capability: "none",
} as const;

function makeApi(overrides: Partial<WorkbenchApiLike> = {}): WorkbenchApiLike {
  return {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: vm as never } }),
    getSnapshot: async () => ({ ok: true, data: vm as never }),
    setMode: async () => ({ ok: true, data: { ok: true } }),
    manualSend: async () => ({ ok: true, data: { ok: true } }),
    noSaveSend: async () => ({ ok: true, data: { ok: true } }),
    cancel: async () => ({ ok: true, data: { ok: true } }),
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s1", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
    ...overrides,
  };
}

test("I-30: no legacy agent-send keyboard mapping exists in the suggestion panel (Composer is the single reply surface)", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "suggestion-panel.ts"), "utf-8");
  // legacy send path is gone: no manual_send / no_save_send actions, no keydown->send mapping
  for (const t of ["手动发送", "不保存发送", "manual_send", "no_save_send", "onManualSend", "onNoSaveSend", "addEventListener(\"keydown\")"]) {
    assert.ok(!src.includes(t), "suggestion-panel must not contain legacy send path: " + t);
  }
  // the ONLY agent reply path is apply-suggestion -> composer
  assert.ok(src.includes("使用建议"), "explicit apply to composer remains");
  assert.ok(src.includes("取消生成"), "generation cancel remains, semantically separate from send");
});

test("duplicate keypress UX is guarded while the same command is pending", async () => {
  const store = new WorkbenchStore(makeApi());
  await store.boot();
  const p = store.manualSend();
  assert.equal(store.isCommandPending("manual_send"), true, "second Enter should be ignored while pending");
  await p;
  assert.equal(store.isCommandPending("manual_send"), false);
});
