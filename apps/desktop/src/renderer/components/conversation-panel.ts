// M6 conversation panel (clean-room): safe conversation/send/takeover projection.
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";
import { emptyState } from "./states/empty.js";

export function renderConversationPanel(root: HTMLElement, state: UiState): void {
  clear(root);
  const panel = el("section", "conversation-panel");
  panel.appendChild(el("h3", "panel-title", "会话"));
  const vm = state.viewModel;
  const conv = vm?.conversation;
  if (!conv) {
    panel.appendChild(emptyState({ meaning: "no-work", title: "暂无活动会话", body: "当前店铺没有活动会话" }));
  } else {
    const rows = el("dl", "conversation-facts");
    rows.appendChild(fact("会话状态", conv.state));
    if (conv.buyer) rows.appendChild(fact("买家", conv.buyer));
    panel.appendChild(rows);
  }
  const send = vm?.send_status;
  if (send) panel.appendChild(el("p", "send-status", `发送状态: ${send}`));
  const takeover = vm?.takeover_status;
  if (takeover) panel.appendChild(el("p", "takeover-status", `接管状态: ${takeover}`));
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
