// M10 review panel (clean-room). Projection + typed control only.
// Review propose/apply/restore are background jobs executed by the Worker;
// rollback snapshots and deletion records are durable in Main-owned stores.
import type { M10PanelViewModel, M10PanelActions } from "./m10-panel-types.js";
import { clear, el, button } from "./dom.js";

export function renderReviewPanel(root: HTMLElement, m10: M10PanelViewModel, actions: M10PanelActions): void {
  clear(root);
  const panel = el("section", "m10-panel review-panel");
  const title = el("h3", "panel-title", "知识审查");
  panel.appendChild(title);
  const last = m10.lastReviewEvent ? el("p", "last-event", "最近事件: " + m10.lastReviewEvent) : el("p", "last-event muted", "尚未发起审查");
  panel.appendChild(last);
  const row = el("div", "panel-actions");
  row.appendChild(button("review-propose", "生成删除提案", () => actions.onReviewPropose()));
  row.appendChild(button("review-apply", "执行删除", () => actions.onReviewApply()));
  row.appendChild(button("review-restore", "恢复删除", () => actions.onReviewRestore()));
  panel.appendChild(row);
  root.appendChild(panel);
}
