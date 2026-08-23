// M11 legacy import plan view (clean-room). Projection of dry-run results.
import type { LegacyImportPanelViewModel } from "./legacy-import-types.js";
import { clear, el } from "./dom.js";

export function renderLegacyImportPlanView(root: HTMLElement, vm: LegacyImportPanelViewModel): void {
  clear(root);
  const host = el("div", "legacy-plan-view");
  if (!vm.plan) {
    host.appendChild(el("p", "muted", "尚未生成导入计划"));
    root.appendChild(host);
    return;
  }
  host.appendChild(el("p", "plan-checksum", "计划校验: " + vm.plan.plan_sha256));
  for (const item of vm.plan.items) {
    const row = el("div", "plan-item");
    row.appendChild(el("span", "plan-item-name", item.display_name));
    row.appendChild(el("span", "plan-item-count", item.record_count + " 条 → " + item.target_aggregate));
    host.appendChild(row);
  }
  root.appendChild(host);
}
