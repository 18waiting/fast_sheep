// M11 legacy import source list (clean-room). Shows selected source items only.
import type { LegacyImportPanelViewModel } from "./legacy-import-types.js";
import { clear, el } from "./dom.js";

export function renderLegacyImportSourceList(root: HTMLElement, vm: LegacyImportPanelViewModel): void {
  clear(root);
  const host = el("div", "legacy-source-list");
  const count = el("p", "source-count", vm.selection_token ? "已选择 " + vm.item_count + " 个数据文件" : "尚未选择数据文件");
  host.appendChild(count);
  root.appendChild(host);
}
