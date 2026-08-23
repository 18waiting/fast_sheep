// M11 legacy import conflict view (clean-room). Conflicts/warnings + secret
// field names only (never values).
import type { LegacyImportPanelViewModel } from "./legacy-import-types.js";
import { clear, el } from "./dom.js";

export function renderLegacyImportConflictView(root: HTMLElement, vm: LegacyImportPanelViewModel): void {
  clear(root);
  const host = el("div", "legacy-conflict-view");
  if (!vm.plan) {
    host.appendChild(el("p", "muted", "无冲突信息"));
    root.appendChild(host);
    return;
  }
  const secrets = vm.plan.secret_fields_detected;
  if (secrets.length > 0) {
    host.appendChild(el("p", "warning", "检测到敏感字段(仅名称): " + secrets.join(", ") + " — 默认跳过"));
  }
  const conflicts = vm.plan.items.flatMap((i) => i.conflicts.map((c) => ({ item: i.display_name, ...c })));
  if (conflicts.length === 0) host.appendChild(el("p", "ok", "无冲突"));
  for (const c of conflicts) {
    host.appendChild(el("p", "conflict", c.item + " — " + c.identity + ": " + c.reason + " (" + c.policy + ")"));
  }
  root.appendChild(host);
}
