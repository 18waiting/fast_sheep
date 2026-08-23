// M11 legacy import result view (clean-room). Completed state projection only.
import type { LegacyImportPanelViewModel } from "./legacy-import-types.js";
import { clear, el } from "./dom.js";

export function renderLegacyImportResultView(root: HTMLElement, vm: LegacyImportPanelViewModel): void {
  clear(root);
  const host = el("div", "legacy-import-result");
  if (!vm.session) {
    host.appendChild(el("p", "muted", "无导入结果"));
    root.appendChild(host);
    return;
  }
  if (vm.session.state === "COMPLETED" || vm.session.state === "VERIFIED") {
    host.appendChild(el("p", "ok", "导入完成 (会话 " + vm.session.session_id + ")"));
  } else if (vm.session.state === "FAILED_RECOVERABLE") {
    host.appendChild(el("p", "error", "导入可恢复失败 — 可安全重试同一会话"));
  } else {
    host.appendChild(el("p", "muted", "导入未完成"));
  }
  root.appendChild(host);
}
