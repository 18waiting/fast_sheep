// M10 audit panel (clean-room). Projection + typed control only.
// 保留/丢弃/待定 are forwarded to Main -> Worker audit.decide; the renderer
// never writes candidates or knowledge.
import type { M10PanelViewModel, M10PanelActions } from "./m10-panel-types.js";
import { clear, el, button } from "./dom.js";

export function renderAuditPanel(root: HTMLElement, m10: M10PanelViewModel, actions: M10PanelActions): void {
  clear(root);
  const panel = el("section", "m10-panel audit-panel");
  const title = el("h3", "panel-title", "知识审核");
  panel.appendChild(title);
  const last = m10.lastAuditEvent ? el("p", "last-event", "最近事件: " + m10.lastAuditEvent) : el("p", "last-event muted", "暂无待审核操作");
  panel.appendChild(last);
  const row = el("div", "panel-actions");
  row.appendChild(button("audit-approve", "保留", () => actions.onAudit("保留")));
  row.appendChild(button("audit-discard", "丢弃", () => actions.onAudit("丢弃")));
  row.appendChild(button("audit-pending", "待定", () => actions.onAudit("待定")));
  panel.appendChild(row);
  root.appendChild(panel);
}
