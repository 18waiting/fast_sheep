import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_UI_STATE, activeConversationPresentation, type UiState } from "../dist/renderer/state/view-model.js";
import type { WorkbenchViewModel, QueueItemView } from "@fastwork/desktop-ipc";

// SHEEP-063 REPAIR (I-7 concretization / I-26): active-conversation presentation
//   - active exists => presentation reflects the active identity (NEVER 无会话)
//   - c1 -> c2 switch => header presentation follows the active identity (no mixed context)
//   - Queue Store/Platform Scope change must NOT rewrite the active header identity
//   - no-active state ONLY when activeConversationId == null
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer", "components");

function vmWithConversation(id: string, state = "idle", buyer?: string): WorkbenchViewModel {
  return {
    revision: 1,
    shop_summaries: [],
    selected_shop_id: "shop-ambient",
    conversation: { conversation_id: id, shop_id: "shop-ambient", state, buyer },
    suggestion: null,
    mode: "human_review",
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}
function stateWith(overrides: Partial<UiState>): UiState {
  return { ...EMPTY_UI_STATE, ...overrides };
}

test("active conversation exists => presentation reflects active identity (≠ no-conversation), store from active queue item", () => {
  const items: QueueItemView[] = [{ conversation_id: "c1", store_id: "A1" }, { conversation_id: "c2", store_id: "A2" }];
  const s = stateWith({ activeConversationId: "c1", queueItems: items, viewModel: vmWithConversation("c1", "CLAIMED", "买家甲") });
  const p = activeConversationPresentation(s);
  assert.ok(p, "active conversation must yield a presentation (not null/no-conversation)");
  assert.equal(p?.conversationId, "c1");
  assert.equal(p?.storeId, "A1", "store from the active queue item (conversation-bound fact)");
  assert.equal(p?.state, "CLAIMED", "state only from matching viewModel.conversation");
  assert.equal(p?.buyer, "买家甲");
});

test("c1 -> c2 switch: header presentation follows the active identity (no mixed context, I-7)", () => {
  const items: QueueItemView[] = [{ conversation_id: "c1", store_id: "A1" }, { conversation_id: "c2", store_id: "A2" }];
  const s1 = stateWith({ activeConversationId: "c1", queueItems: items, viewModel: vmWithConversation("c1") });
  const p1 = activeConversationPresentation(s1);
  assert.equal(p1?.conversationId, "c1");
  const s2 = { ...s1, activeConversationId: "c2" };
  const p2 = activeConversationPresentation(s2);
  assert.equal(p2?.conversationId, "c2", "header presentation must follow the active identity");
  assert.equal(p2?.storeId, "A2");
  // viewModel.conversation is c1 but active is c2 -> its facts must NOT leak (mixed context)
  assert.equal(p2?.state, null, "c1 viewModel facts must not be presented as c2 (no mixed context)");
});

test("Queue Store/Platform Scope change must NOT rewrite the active header identity (I-7/I-26)", () => {
  const items: QueueItemView[] = [{ conversation_id: "c1", store_id: "A1" }];
  const base = stateWith({ activeConversationId: "c1", queueItems: items, viewModel: vmWithConversation("c1") });
  const before = activeConversationPresentation(base);
  // change queue scope (ambient) — must not affect active header identity
  const scoped = { ...base, queueScope: { kind: "specific_store", storeId: "B9" } as const };
  const after = activeConversationPresentation(scoped);
  assert.equal(after?.conversationId, before?.conversationId, "scope change must not rewrite active header identity");
  assert.equal(after?.storeId, "A1", "store stays the active conversation's store, not the queue scope store");
});

test("no-active state only when activeConversationId == null (I-7)", () => {
  assert.equal(activeConversationPresentation(stateWith({ activeConversationId: null })), null, "no active -> null (no-conversation only here)");
  assert.equal(activeConversationPresentation(stateWith({ activeConversationId: "c1" }))?.conversationId, "c1", "any non-null active -> identity");
});

test("header + conversation-panel use the active-conversation presentation; no-conversation copy is gated on activeConversationId == null (I-7)", () => {
  for (const f of ["workbench-header.ts", "conversation-panel.ts"]) {
    const src = readFileSync(join(R, f), "utf-8");
    assert.ok(src.includes("activeConversationPresentation"), f + " must use the active-conversation presentation helper");
    assert.ok(src.includes("active === null"), f + " must gate the no-active state on activeConversationId == null");
    assert.ok(!src.includes('conv ? `会话'), f + " must not render a conversation line from ambient vm.conversation");
  }
});
