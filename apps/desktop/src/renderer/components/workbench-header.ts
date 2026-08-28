// M6 workbench header (clean-room): reflects the authoritative ACTIVE Conversation
// identity when one exists (SHEEP-063 REPAIR, I-7 concretization / I-26).
// Header facts are conversation-bound only: active conversation id (navigation
// anchor), store_id from the active queue item (Main-projected conversation fact),
// and viewModel.conversation facts ONLY when they match the active identity.
// Never falls back to selectedShop / Queue Scope / ambient state; when a fact is
// unavailable it is omitted or shown as 未知 — never fabricated.
import type { UiState } from "../state/view-model.js";
import { activeConversationPresentation } from "../state/view-model.js";
import { clear, el } from "./dom.js";

export function renderWorkbenchHeader(root: HTMLElement, state: UiState): void {
  clear(root);
  const header = el("header", "workbench-header");
  const active = activeConversationPresentation(state);
  if (active === null) {
    // I-7/I-26: no-active state is used ONLY when activeConversationId == null.
    const shop = state.viewModel?.shop_summaries.find((s) => s.shop_id === state.selectedShopId);
    header.appendChild(el("div", "header-shop", shop ? shop.name : "未选择店铺"));
    header.appendChild(el("div", "header-conversation", "无会话"));
    header.appendChild(el("div", "header-platform", `平台能力: ${state.viewModel?.platform_capability ?? "none"}`));
    root.appendChild(header);
    return;
  }
  // Active conversation identity is the authoritative anchor; never "无会话".
  header.appendChild(el("div", "header-conversation", `当前会话: ${active.conversationId}`));
  // store_id is a Main-projected conversation fact (from the active queue item).
  header.appendChild(el("div", "header-store", active.storeId !== null ? `店铺: ${active.storeId}` : "店铺: 未知"));
  // state only when the viewModel.conversation matches the active identity.
  if (active.state !== null) header.appendChild(el("div", "header-state", `状态: ${active.state}`));
  // platform is NOT a trusted active-conversation fact here -> omitted (no ambient backfill).
  root.appendChild(header);
}
