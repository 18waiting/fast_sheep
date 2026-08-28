import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import type { WorkbenchViewModel, TimelineMessageView } from "@fastwork/desktop-ipc";

// SHEEP-063 renderer/contract guards:
//   - DP-85/DP-89/I-7: timeline is bound to the active conversation; switching
//     active identity must not keep previous conversation facts
//   - I-14: stale timeline response must not overwrite the current active conversation
//   - I-25/DP-48: authorization-context unavailable is an error state, NOT empty data
//   - purpose-built view: no observed_at / external metadata
//   - component renders facts via textContent only (no innerHTML)
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer");

function vm(): WorkbenchViewModel {
  return {
    revision: 1,
    shop_summaries: [{ shop_id: "shop-test-1", name: "测试店铺A", type: "pdd", enabled: true }],
    selected_shop_id: "shop-test-1",
    conversation: { conversation_id: "c1", shop_id: "shop-test-1", state: "idle" },
    suggestion: null,
    mode: "human_review",
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}
function makeApi(overrides: Partial<WorkbenchApiLike> = {}): WorkbenchApiLike {
  return {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: vm().shop_summaries ?? [], view_model: vm() } }),
    getSnapshot: async () => ({ ok: true, data: vm() }),
    setMode: async () => ({ ok: true, data: { ok: true } }),
    manualSend: async () => ({ ok: true, data: { ok: true } }),
    noSaveSend: async () => ({ ok: true, data: { ok: true } }),
    cancel: async () => ({ ok: true, data: { ok: true } }),
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
    ...overrides,
  };
}
function msg(id: string, actor: "customer" | "agent", text: string, occurredAt?: string | null): TimelineMessageView {
  return { message_id: id, actor, content_kind: "text", content_text: text, occurred_at: occurredAt ?? null };
}

test("refreshTimeline loads messages bound to the requested conversation (DP-84/85)", async () => {
  const api = makeApi({
    listConversationMessages: async (req) => ({ ok: true, data: { conversation_id: req.conversation_id, messages: [msg("m1", "customer", "你好")] } }),
  });
  const store = new WorkbenchStore(api);
  await store.refreshTimeline("c1");
  const s = store.getState();
  assert.equal(s.timelineConversationId, "c1", "timeline bound to c1");
  assert.deepEqual(s.timelineMessages.map((m) => m.message_id), ["m1"]);
  assert.equal(s.timelineError, null);
});

test("I-14 stale protection: old response must not overwrite the current active conversation", async () => {
  let calls = 0;
  const api = makeApi({
    listConversationMessages: async (req) => {
      const my = ++calls;
      if (my === 1) await new Promise((r) => setTimeout(r, 30)); // slow c1
      return { ok: true, data: { conversation_id: req.conversation_id, messages: [msg("m-" + req.conversation_id, "agent", req.conversation_id)] } };
    },
  });
  const store = new WorkbenchStore(api);
  const p1 = store.refreshTimeline("c1");
  const p2 = store.refreshTimeline("c2");
  await p1; await p2;
  await new Promise((r) => setTimeout(r, 40));
  const s = store.getState();
  assert.equal(s.timelineConversationId, "c2", "late c1 response must not overwrite c2");
  assert.deepEqual(s.timelineMessages.map((m) => m.message_id), ["m-c2"], "only current active facts shown");
});

test("I-7/DP-89: activation switch clears previous conversation facts before loading new", async () => {
  let c1resolved = false;
  const api = makeApi({
    listConversationMessages: async (req) => {
      if (req.conversation_id === "c1") {
        c1resolved = true;
        return { ok: true, data: { conversation_id: "c1", messages: [msg("old", "customer", "旧会话消息")] } };
      }
      // c2 response delayed to observe the cleared intermediate state
      await new Promise((r) => setTimeout(r, 40));
      return { ok: true, data: { conversation_id: "c2", messages: [msg("new", "agent", "新会话消息")] } };
    },
  });
  const store = new WorkbenchStore(api);
  store.activateConversation("c1");
  const deadline = Date.now() + 3000;
  while (!c1resolved && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
  await new Promise((r) => setTimeout(r, 20)); // let the store apply c1 items
  assert.equal(store.getState().timelineMessages[0]?.message_id, "old", "c1 loaded");

  store.activateConversation("c2");
  // immediately after switch, old c1 facts must be gone (not shown as c2)
  const mid = store.getState();
  assert.ok(mid.timelineConversationId === null || mid.timelineConversationId === "c2", "old conversation no longer bound");
  assert.deepEqual(mid.timelineMessages, [], "old c1 facts cleared on switch (no residue)");
  await new Promise((r) => setTimeout(r, 60));
  const s = store.getState();
  assert.equal(s.timelineConversationId, "c2");
  assert.deepEqual(s.timelineMessages.map((m) => m.message_id), ["new"], "c2 facts loaded");
});

test("I-25: workspace-unavailable is an error state, NOT empty data (DP-48)", async () => {
  const api = makeApi({
    listConversationMessages: async () => ({ ok: false, error: { code: "desktop.workspace_unavailable", category: "internal", message: "workspace merchant context unavailable", retryable: false } }),
  });
  const store = new WorkbenchStore(api);
  await store.refreshTimeline("c1");
  const s = store.getState();
  assert.ok(s.timelineError, "unavailable -> timeline error state");
  assert.equal(s.timelineMessages.length, 0, "not represented as empty success");
});

test("authorized 0 rows -> legitimate empty (no error)", async () => {
  const api = makeApi({
    listConversationMessages: async (req) => ({ ok: true, data: { conversation_id: req.conversation_id, messages: [] } }),
  });
  const store = new WorkbenchStore(api);
  await store.refreshTimeline("c1");
  const s = store.getState();
  assert.equal(s.timelineError, null, "real empty -> no error");
  assert.deepEqual(s.timelineMessages, []);
});

test("timeline component: textContent only (no innerHTML), purpose-built view, no observed_at (DP-88/I-8/DP-61)", () => {
  const src = readFileSync(join(R, "components", "message-timeline.ts"), "utf-8");
  assert.ok(!src.includes("innerHTML"), "message-timeline must not use innerHTML");
  assert.ok(!src.includes("observed_at"), "message-timeline must not use observed_at");
  for (const t of ["ipcRenderer", "fetch(", "WebSocket", "localStorage", "api_key", "credential"]) {
    assert.ok(!src.includes(t), "message-timeline must not use " + t);
  }
  assert.ok(src.includes("（消息内容未知）"), "incomplete historical facts are presented honestly (DP-92/I-16)");
  assert.ok(src.includes("时间未知"), "unknown occurred_at stays unknown (DP-93)");
});
