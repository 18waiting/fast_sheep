// SHEEP-031 clean-room AI Panel layout component.
// Reference evidence (ai.js, SHEEP-022) confirms three regions exist in the AI Panel:
// a feature-list area, a chat area, and a welcome/preset-questions area.
// Fast Sheep implementation: structural regions only. The exact DOM hierarchy is NOT
// confirmed by evidence; nesting ai-welcome inside ai-chat is a provisional clean-room
// decision (reference-derived = NO / INFERRED; reference_match_status = NOT_ESTABLISHED).
// No messaging behavior, no preset-card API or interaction, no feature-list content is
// implemented here. The component is NOT mounted (placement deferred; runtime
// integration / API stability = NOT_ESTABLISHED). `ai-tools` names only a UI
// feature-list region; it introduces no domain behavior.
import { clear, el } from "./dom.js";

export function renderAiPanel(root: HTMLElement): void {
  clear(root);

  const panel = el("section", "ai-panel");
  panel.setAttribute("aria-label", "AI 面板");

  const tools = el("div", "ai-tools");
  tools.setAttribute("aria-label", "功能列表区");
  panel.appendChild(tools);

  const chat = el("div", "ai-chat");
  chat.setAttribute("aria-label", "聊天区");
  const welcome = el("div", "ai-welcome");
  welcome.setAttribute("aria-label", "欢迎/预设问题区");
  chat.appendChild(welcome);
  panel.appendChild(chat);

  root.appendChild(panel);
}