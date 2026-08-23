// M10 product optimization panel (clean-room). Projection + typed control only.
// Proposal comes from the Worker; Main applies the product mutation atomically
// (guards/cooldown/backup). The renderer never writes products.
import type { M10PanelViewModel, M10PanelActions } from "./m10-panel-types.js";
import { clear, el, button } from "./dom.js";

export function renderProductOptimizationPanel(root: HTMLElement, m10: M10PanelViewModel, actions: M10PanelActions): void {
  clear(root);
  const panel = el("section", "m10-panel optimization-panel");
  const title = el("h3", "panel-title", "商品优化");
  panel.appendChild(title);
  const last = m10.lastOptimizationEvent ? el("p", "last-event", "最近事件: " + m10.lastOptimizationEvent) : el("p", "last-event muted", "尚未优化商品");
  panel.appendChild(last);
  const row = el("div", "panel-actions");
  row.appendChild(button("opt-propose", "生成优化提案", () => actions.onOptimizationPropose("10001")));
  row.appendChild(button("opt-apply", "应用优化", () => actions.onOptimizationApply("10001", "<优化后详情>")));
  panel.appendChild(row);
  root.appendChild(panel);
}
