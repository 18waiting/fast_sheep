// M6 conversation panel (clean-room): reflects the authoritative ACTIVE Conversation
// identity when one exists (SHEEP-063 REPAIR, I-7 concretization / I-26). Facts are
// conversation-bound only; never falls back to selectedShop / Queue Scope / ambient
// state; unavailable facts are omitted / shown as 未知, never fabricated.
import type { UiState } from "../state/view-model.js";
import { activeConversationPresentation } from "../state/view-model.js";
import { clear, el } from "./dom.js";
import { emptyState } from "./states/empty.js";

export function renderConversationPanel(root: HTMLElement, state: UiState): void {
  clear(root);
  const panel = el("section", "conversation-panel");
  panel.appendChild(el("h3", "panel-title", "会话"));
  const active = activeConversationPresentation(state);
  if (active === null) {
    // No-active: only when activeConversationId == null (I-7/I-26). Fall back to the
    // clean-room legacy projection for the no-active header; no conversation -> no-work.
    const conv = state.viewModel?.conversation;
    if (!conv) {
      panel.appendChild(emptyState({ meaning: "no-work", title: "暂无活动会话", body: "当前店铺没有活动会话" }));
    } else {
      const rows = el("dl", "conversation-facts");
      rows.appendChild(fact("会话状态", conv.state));
      if (conv.buyer) rows.appendChild(fact("买家", conv.buyer));
      panel.appendChild(rows);
      if (state.viewModel?.send_status) panel.appendChild(el("p", "send-status", `发送状态: ${state.viewModel.send_status}`));
      if (state.viewModel?.takeover_status) panel.appendChild(el("p", "takeover-status", `接管状态: ${state.viewModel.takeover_status}`));
    }
    root.appendChild(panel);
    return;
  }
  // Active conversation identity is the authoritative anchor; never "暂无活动会话".
  panel.appendChild(el("p", "conversation-active-id", `当前会话: ${active.conversationId}`));
  if (active.storeId !== null) panel.appendChild(el("p", "conversation-active-store", `店铺: ${active.storeId}`));
  if (active.state !== null) panel.appendChild(fact("会话状态", active.state));
  if (active.buyer !== null) panel.appendChild(fact("买家", active.buyer));
  // send/takeover only from a matching active-conversation projection; otherwise omitted.
  const vm = state.viewModel;
  if (vm?.conversation && vm.conversation.conversation_id === active.conversationId) {
    if (vm.send_status) panel.appendChild(el("p", "send-status", `发送状态: ${vm.send_status}`));
    if (vm.takeover_status) panel.appendChild(el("p", "takeover-status", `接管状态: ${vm.takeover_status}`));
  }
  root.appendChild(panel);
}

function fact(label: string, value: string): HTMLElement {
  const dt = el("dt", "fact-label", label);
  const dd = el("dd", "fact-value", value);
  const group = el("div", "fact");
  group.appendChild(dt);
  group.appendChild(dd);
  return group;
}

