// M11 legacy import progress (clean-room). Phase/state projection only.
import type { LegacyImportPanelViewModel } from "./legacy-import-types.js";
import { clear, el } from "./dom.js";

export function renderLegacyImportProgress(root: HTMLElement, vm: LegacyImportPanelViewModel): void {
  clear(root);
  const host = el("div", "legacy-import-progress");
  if (!vm.session) {
    host.appendChild(el("p", "muted", "无进行中的导入"));
    root.appendChild(host);
    return;
  }
  host.appendChild(el("p", "state", "状态: " + vm.session.state));
  host.appendChild(el("p", "phases", "阶段: " + vm.session.phases.join(" → ")));
  if (vm.session.error) host.appendChild(el("p", "error", vm.session.error.slice(0, 200)));
  root.appendChild(host);
}
