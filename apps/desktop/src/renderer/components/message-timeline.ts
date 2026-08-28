// SHEEP-063 Message Timeline (clean-room): Conversation Main primary content
// surface (DP-85). Bound to the ACTIVE conversation only; never shows facts of a
// different conversation (DP-89/I-7). All facts are rendered via textContent only
// (textContent only; no HTML payload / markdown / sanitization framework, DP-88).
import type { UiState } from "../state/view-model.js";
import type { TimelineMessageView } from "@fastwork/desktop-ipc";
import { clear, el } from "./dom.js";
import { emptyState } from "./states/empty.js";
import { loadingState } from "./states/loading.js";
import { errorState } from "./states/error.js";

export function renderMessageTimeline(root: HTMLElement, state: UiState): void {
  clear(root);
  const section = el("section", "message-timeline");
  section.appendChild(el("h3", "panel-title", "消息时间线"));

  const activeId = state.activeConversationId;
  if (!activeId) {
    section.appendChild(emptyState({ meaning: "no-work", title: "未选择会话", body: "从左侧队列选择一个会话查看消息时间线。" }));
    root.appendChild(section);
    return;
  }
  // DP-85/DP-89/I-7: the displayed timeline must match the ACTIVE conversation
  // identity; if facts are not yet loaded for it, show loading (never old facts).
  if (state.timelineConversationId !== activeId) {
    section.appendChild(loadingState({ label: "正在加载消息" }));
    root.appendChild(section);
    return;
  }
  // I-25/DP-47: timeline failure is contained to the Timeline scope and is never
  // represented as empty business data (queue/identity/manual workflow unaffected).
  if (state.timelineError && state.timelineMessages.length === 0) {
    section.appendChild(errorState({ scope: "inline", message: "会话消息加载失败。" }));
    root.appendChild(section);
    return;
  }
  // Authorized query with 0 rows -> legitimate no-work empty (I-25).
  if (state.timelineMessages.length === 0) {
    section.appendChild(emptyState({ meaning: "no-work", title: "暂无消息", body: "该会话当前没有消息事实。" }));
    root.appendChild(section);
    return;
  }
  const list = el("ol", "timeline-list");
  for (const m of state.timelineMessages) {
    list.appendChild(renderMessageRow(m));
  }
  section.appendChild(list);
  root.appendChild(section);
}

function renderMessageRow(m: TimelineMessageView): HTMLElement {
  // DP-92 minimal presentability rule: a row with known actor AND known text
  // content is a normal message; anything else is presented honestly as unknown
  // (never a normal chat bubble, I-16).
  const normal = m.actor !== null && m.content_kind === "text" && m.content_text !== null;
  const li = el("li", normal ? "timeline-message timeline-message--" + m.actor : "timeline-message timeline-message--unknown");
  // actor is a domain fact; direction is presentation mapping only (approved #6).
  li.appendChild(el("span", "timeline-actor", m.actor === "customer" ? "客户" : m.actor === "agent" ? "客服" : "未知方向"));
  // DP-93: time display is presentation over explicit facts; unknown stays unknown.
  li.appendChild(el("span", "timeline-time", formatOccurredAt(m.occurred_at)));
  const body = el("div", "timeline-content");
  if (m.content_kind === "text" && m.content_text !== null) {
    body.textContent = m.content_text; // textContent only (DP-88)
  } else {
    body.textContent = "（消息内容未知）"; // DP-92/I-16: incomplete historical facts
  }
  li.appendChild(body);
  return li;
}

function formatOccurredAt(occurredAt: string | null): string {
  if (occurredAt === null) return "时间未知";
  const d = new Date(occurredAt);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return d.toLocaleString();
}

