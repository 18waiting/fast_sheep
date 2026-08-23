// M10 learning panel (clean-room). Projection + typed control only.
// Starting learning only schedules a background job; Main/Worker own all
// knowledge lifecycle writes.
import type { M10PanelViewModel, M10PanelActions } from "./m10-panel-types.js";
import { clear, el, button } from "./dom.js";

export function renderLearningPanel(root: HTMLElement, m10: M10PanelViewModel, actions: M10PanelActions): void {
  clear(root);
  const panel = el("section", "m10-panel learning-panel");
  const title = el("h3", "panel-title", "离线学习");
  panel.appendChild(title);
  const last = m10.lastLearningEvent ? el("p", "last-event", "最近事件: " + m10.lastLearningEvent) : el("p", "last-event muted", "尚未开始学习");
  panel.appendChild(last);
  const row = el("div", "panel-actions");
  row.appendChild(button("learning-start", "开始学习", () => actions.onStartLearning()));
  panel.appendChild(row);
  root.appendChild(panel);
}
