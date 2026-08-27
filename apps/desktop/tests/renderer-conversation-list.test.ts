import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import type { WorkbenchViewModel, QueueScope, QueueItemView } from "@fastwork/desktop-ipc";

// SHEEP-060 renderer/contract guards:
//   - QueueScope contract: all_stores | specific_store; NO fake storeId="all" (I-2/I-6)
//   - QueueItemView minimal facts only (DP-58/64/61): no summary/unread/priority/risk
//   - store: activation = navigation state (DP-69); scope change re-queries and does NOT
//     clear active conversation (DP-59/5)
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer");

function vm(): WorkbenchViewModel {
  return {
    revision: 1,
    shop_summaries: [{ shop_id: "shop-test-1", name: "测试店铺A", type: "pdd", enabled: true }],
    selected_shop_id: "shop-test-1",
    conversation: { conversation_id: "c1", shop_id: "shop-test-1", state: "idle", buyer: "买家-张三" },
    suggestion: null,
    mode: "human_review",
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}
function makeApi(queueItems: QueueItemView[] = []): WorkbenchApiLike {
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
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "shop-test-1", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
    listConversations: async (req: { scope: QueueScope }) => ({ ok: true, data: { items: queueItems, scope: req.scope } }),
  };
}

test("QueueScope contract: all_stores | specific_store, no fake storeId=\"all\" (I-2/I-6)", () => {
  const all: QueueScope = { kind: "all_stores" };
  const specific: QueueScope = { kind: "specific_store", storeId: "A1" };
  assert.equal(all.kind, "all_stores");
  assert.equal(specific.kind, "specific_store");
  assert.ok(specific.storeId !== "all", "specific_store must not use storeId=\"all\"");
  const src = readFileSync(join(R, "components", "conversation-list.ts"), "utf-8") + readFileSync(join(R, "state", "workbench-store.ts"), "utf-8");
  assert.ok(!src.includes('storeId: "all"') && !src.includes('"storeId": "all"'), "no fake storeId=all in queue code");
});

test("QueueItemView is minimal fact-backed (DP-58/64/61): no summary/unread/priority/risk", () => {
  const src = readFileSync(join(R, "components", "conversation-list.ts"), "utf-8");
  for (const t of ["summary", "unread", "priority", "risk", "timestamp", "buyer:"]) {
    assert.ok(!src.includes(t), "conversation-list must not fabricate " + t);
  }
});

test("store: activation is navigation state; scope change re-queries and keeps active conversation (DP-60/69/59)", async () => {
  const store = new WorkbenchStore(makeApi([{ conversation_id: "c1", store_id: "A1" }, { conversation_id: "c2", store_id: "A2" }]));
  await store.boot();
  assert.equal(store.getState().queueItems.length, 2, "queue loaded from typed projection");
  store.activateConversation("c1");
  assert.equal(store.getState().activeConversationId, "c1", "activation sets navigation identity");
  const before = store.getState().activeConversationId;
  await store.setQueueScope({ kind: "specific_store", storeId: "A2" });
  assert.equal(store.getState().activeConversationId, before, "scope change must NOT clear/replace active conversation (DP-59/5)");
  assert.equal(store.getState().queueScope.kind, "specific_store");
  assert.equal(store.getState().queueLoading, false, "queue re-queried after scope change");
});

test("store: queue failure surfaces contained inline error (DP-55/47), active conversation preserved", async () => {
  const api = makeApi();
  api.listConversations = async () => ({ ok: false, error: { code: "x", category: "internal", message: "queue unavailable", retryable: true } });
  const store = new WorkbenchStore(api);
  await store.boot();
  await store.refreshQueue({ kind: "all_stores" });
  assert.ok(store.getState().queueError, "queue error surfaced");
  assert.equal(store.getState().activeConversationId, null, "no active conversation invented");
});