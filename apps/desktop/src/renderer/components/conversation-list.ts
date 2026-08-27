// SHEEP-060 Conversation List (Queue) — Agent primary work-entry surface.
// DP-58: minimal fact-backed items (conversation_id, store_id only; no fabricated
//   display fields).
// DP-60: activation separate from keyboard focus — native <button> means Tab moves
//   focus without activating; Enter/Space/pointer-click activates the row.
// DP-63: deterministic technical ordering by conversation_id (no product-ordering
//   semantics; UI uses no recency/activity-ordering copy).
// DP-64: no reliable source for display text -> items show identity only (show less).
// DP-69: activation = navigation state only (no claim/mark-read/DB/ownership/store/send).
// I-7: this unit displays only the queue item's own identity facts, so displayed
//   facts always match the item identity (no mixed-context).
// Consumes SHEEP-046 state patterns (loading/error/empty) as real production consumers.
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";
import { emptyState } from "./states/empty.js";
import { loadingState } from "./states/loading.js";
import { errorState } from "./states/error.js";

export interface QueueActions {
  onActivate(conversationId: string): void;
  onScopeAllStores(): void;
  onScopeStore(storeId: string): void;
}

export function renderConversationList(root: HTMLElement, state: UiState, actions: QueueActions): void {
  clear(root);
  const section = el("section", "conversation-list");
  section.appendChild(el("h3", "fs-text--component-title conversation-list-title", "会话队列"));
  const scopeLabel = state.queueScope.kind === "all_stores" ? "范围：全部店铺" : "范围：店铺 " + state.queueScope.storeId;
  section.appendChild(el("div", "fs-text--metadata conversation-list-scope", scopeLabel));

  if (state.queueLoading && state.queueItems.length === 0) {
    section.appendChild(loadingState({ label: "正在加载会话队列" }));
    root.appendChild(section);
    return;
  }
  if (state.queueError && state.queueItems.length === 0) {
    section.appendChild(errorState({ scope: "inline", message: "会话队列加载失败，请重试。" }));
    root.appendChild(section);
    return;
  }
  if (state.queueItems.length === 0) {
    section.appendChild(emptyState({ meaning: "no-work", title: "暂无会话", body: "当前队列范围没有待处理会话。" }));
    root.appendChild(section);
    return;
  }

  const list = el("ul", "conversation-list-items");
  for (const item of state.queueItems) {
    const li = el("li", "conversation-list-item");
    const isActive = state.activeConversationId === item.conversation_id;
    const btn = el("button", ["conversation-list-row", isActive ? "active" : ""].filter(Boolean).join(" "), item.conversation_id) as HTMLButtonElement;
    btn.type = "button";
    btn.setAttribute("aria-current", isActive ? "true" : "false");
    btn.addEventListener("click", () => actions.onActivate(item.conversation_id));
    li.appendChild(btn);
    list.appendChild(li);
  }
  section.appendChild(list);
  root.appendChild(section);
}