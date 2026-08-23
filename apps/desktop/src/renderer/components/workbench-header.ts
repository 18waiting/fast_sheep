// M6 workbench header (clean-room): current shop/conversation + platform capability.
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";

export function renderWorkbenchHeader(root: HTMLElement, state: UiState): void {
  clear(root);
  const vm = state.viewModel;
  const header = el("header", "workbench-header");
  const shop = vm?.shop_summaries.find((s) => s.shop_id === state.selectedShopId);
  header.appendChild(el("div", "header-shop", shop ? shop.name : "未选择店铺"));
  const conv = vm?.conversation;
  header.appendChild(el("div", "header-conversation", conv ? `会话 ${conv.conversation_id} · ${conv.state}` : "无会话"));
  header.appendChild(el("div", "header-platform", `平台能力: ${vm?.platform_capability ?? "none"}`));
  root.appendChild(header);
}
