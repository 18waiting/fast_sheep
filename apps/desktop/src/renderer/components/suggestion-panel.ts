// M6 suggestion panel (clean-room).
// Actions map ONLY to typed IPC commands (manual_send / no_save_send / cancel).
// Enter -> manual send, Alt+Enter -> no-save send, but ONLY within this panel
// and ONLY when a pending suggestion is visible (UI context). The renderer
// never decides business eligibility; Main remains the correctness authority.
import type { UiState } from "../state/view-model.js";
import { resolveSuggestionKey } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import { button, clear, el } from "./dom.js";

export function renderSuggestionPanel(root: HTMLElement, state: UiState, actions: WorkbenchActions): void {
  clear(root);
  const panel = el("section", "suggestion-panel");
  panel.appendChild(el("h3", "panel-title", "AI 建议"));
  const vm = state.viewModel;
  const suggestion = vm?.suggestion;
  if (!suggestion) {
    panel.appendChild(el("p", "suggestion-empty", "暂无建议"));
    root.appendChild(panel);
    return;
  }
  const body = el("div", "suggestion-body");
  const text = el("p", "suggestion-text");
  text.textContent = suggestion.reply; // safe: untrusted customer/AI text
  body.appendChild(text);
  body.appendChild(el("span", "suggestion-meta", `generation #${suggestion.generation} · ${suggestion.status}`));
  panel.appendChild(body);

  const sendBusy = state.pendingCommand === "manual_send" || state.pendingCommand === "no_save_send";
  const cancelBusy = state.pendingCommand === "cancel";
  const modeBusy = state.pendingCommand === "set_mode";

  const controls = el("div", "suggestion-controls");
  const manual = button("btn btn-manual", "手动发送 (Enter)", () => actions.onManualSend());
  manual.disabled = sendBusy || modeBusy;
  const noSave = button("btn btn-no-save", "不保存发送 (Alt+Enter)", () => actions.onNoSaveSend());
  noSave.disabled = sendBusy || modeBusy;
  const cancelBtn = button("btn btn-cancel", "取消", () => actions.onCancel());
  cancelBtn.disabled = cancelBusy || modeBusy;
  controls.appendChild(manual);
  controls.appendChild(noSave);
  controls.appendChild(cancelBtn);
  panel.appendChild(controls);

  // Keyboard: only active in the suggestion context, never a global hijack.
  panel.addEventListener("keydown", (event) => {
    if (sendBusy || modeBusy) return;
    const action = resolveSuggestionKey({ key: event.key, altKey: event.altKey });
    if (action === "manual_send") {
      event.preventDefault();
      actions.onManualSend();
    } else if (action === "no_save_send") {
      event.preventDefault();
      actions.onNoSaveSend();
    }
  });
  panel.tabIndex = 0;
  root.appendChild(panel);
}
