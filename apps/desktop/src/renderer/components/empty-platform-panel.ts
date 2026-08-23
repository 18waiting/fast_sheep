// M6 empty platform panel (clean-room).
// M7/M8 platform adapters are absent: show a clean local placeholder.
// No remote iframe/webview/browser content. Test mode may only show synthetic
// local data (already enforced in Main).
import { clear, el } from "./dom.js";

export function renderEmptyPlatformPanel(root: HTMLElement): void {
  clear(root);
  const panel = el("section", "empty-platform-panel");
  panel.appendChild(el("h3", "panel-title", "平台接入"));
  panel.appendChild(el("p", "empty-platform-text", "平台适配器尚未启用 (M7/M8 接入)。当前仅展示本地工作台。"));
  root.appendChild(panel);
}
