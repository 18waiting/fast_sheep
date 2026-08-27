// SHEEP-060/061 Conversation List (Queue) — Agent primary work-entry surface.
// DP-70: Queue embeds scope controls; Store is a query scope, not a parallel nav rail.
// DP-71/77: Platform filter uses canonical platform identity (typed union; options
//   fact-backed from Main projection). DP-73/74: filters are query dimensions /
//   query variants (no fake StoreId/PlatformId "all"). DP-75: only Store + Platform
//   dimensions; no filter framework. DP-76: active conversation may remain outside
//   current scope with a calm neutral/info cue (no error/warning, no auto-switch).
// DP-58/60/63/64/69 + I-5/7: minimal facts, activation=navigation state, technical
//   ordering, identity-only items. Native <select> for scope controls (DP-13).
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";
import { emptyState } from "./states/empty.js";
import { loadingState } from "./states/loading.js";
import { errorState } from "./states/error.js";
import type { QueuePlatformFilter } from "@fastwork/desktop-ipc";

export interface QueueActions {
  onActivate(conversationId: string): void;
  onScopeAllStores(): void;
  onScopeStore(storeId: string): void;
  onScopePlatform(platform: QueuePlatformFilter | undefined): void;
}

export function renderConversationList(root: HTMLElement, state: UiState, actions: QueueActions): void {
  clear(root);
  const section = el("section", "conversation-list");
  section.appendChild(el("h3", "fs-text--component-title conversation-list-title", "会话队列"));

  // Scope controls (native select; Store = query scope, Platform = canonical filter).
  const controls = el("div", "conversation-list-controls");
  const storeSelect = el("select", "conversation-list-scope-store", "") as HTMLSelectElement;
  const storeAll = el("option", "", "全部店铺");
  storeAll.value = "__all_stores__";
  storeSelect.appendChild(storeAll);
  for (const s of state.availableStores) {
    const opt = el("option", "", s.name) as HTMLOptionElement;
    opt.value = s.store_id;
    storeSelect.appendChild(opt);
  }
  storeSelect.value = state.queueScope.kind === "specific_store" ? state.queueScope.storeId : "__all_stores__";
  storeSelect.addEventListener("change", () => {
    const v = storeSelect.value;
    if (v === "__all_stores__") actions.onScopeAllStores();
    else actions.onScopeStore(v);
  });
  controls.appendChild(storeSelect);

  const platformSelect = el("select", "conversation-list-scope-platform", "") as HTMLSelectElement;
  const pAll = el("option", "", "全部平台");
  pAll.value = "__all_platforms__";
  platformSelect.appendChild(pAll);
  for (const p of state.availablePlatforms) {
    const opt = el("option", "", p) as HTMLOptionElement;
    opt.value = p;
    platformSelect.appendChild(opt);
  }
  platformSelect.value = state.queuePlatform ?? "__all_platforms__";
  platformSelect.addEventListener("change", () => {
    const v = platformSelect.value;
    actions.onScopePlatform(v === "__all_platforms__" ? undefined : (v as QueuePlatformFilter));
  });
  controls.appendChild(platformSelect);
  section.appendChild(controls);

  // DP-76: active conversation may remain outside current queue scope — calm neutral/info cue.
  if (state.activeConversationId && !state.queueItems.some((i) => i.conversation_id === state.activeConversationId)) {
    section.appendChild(el("div", "fs-status fs-status--info conversation-list-out-of-scope", "当前会话不在当前队列范围"));
  }

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