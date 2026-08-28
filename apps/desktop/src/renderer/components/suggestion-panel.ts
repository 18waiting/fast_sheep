// SHEEP-064 REPAIR (I-30): the Composer is the SINGLE agent reply submission
// surface. The AI suggestion panel provides only:
//   - 使用建议: EXPLICIT, NON-DESTRUCTIVE apply of the suggestion into the Composer
//     draft (DP-106) — never async-auto-applies; non-empty drafts are never silently
//     replaced;
//   - 取消生成: AI generation cancel (semantically separate from send cancel).
// There are NO direct agent-send actions here (I-30): the only agent reply path is
// apply -> Composer. Old direct-send actions are not reachable as an agent reply path.
import type { UiState } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import { button, clear, el } from "./dom.js";
import { emptyState } from "./states/empty.js";

export function renderSuggestionPanel(root: HTMLElement, state: UiState, actions: WorkbenchActions): void {
  clear(root);
  const panel = el("section", "suggestion-panel");
  panel.appendChild(el("h3", "panel-title", "AI 建议"));
  const vm = state.viewModel;
  const suggestion = vm?.suggestion;
  if (!suggestion) {
    panel.appendChild(emptyState({ meaning: "no-result", title: "暂无建议", body: "暂无 AI 建议" })); // baseline consumer validation only; final behavior not locked
    root.appendChild(panel);
    return;
  }
  const body = el("div", "suggestion-body");
  const text = el("p", "suggestion-text");
  text.textContent = suggestion.reply; // safe: untrusted customer/AI text
  body.appendChild(text);
  body.appendChild(el("span", "suggestion-meta", `generation #${suggestion.generation} · ${suggestion.status}`));
  panel.appendChild(body);

  const cancelBusy = state.pendingCommand === "cancel";
  const modeBusy = state.pendingCommand === "set_mode";

  const controls = el("div", "suggestion-controls");
  // I-30: the ONLY agent reply path is 使用建议 -> Composer (explicit, non-destructive).
  controls.appendChild(button("btn btn-apply-suggestion", "使用建议", () => actions.onApplySuggestion()));
  // 取消生成 = AI generation cancel (distinct from any send cancellation; no send here).
  const cancelBtn = button("btn btn-cancel", "取消生成", () => actions.onCancel());
  cancelBtn.disabled = cancelBusy || modeBusy;
  controls.appendChild(cancelBtn);
  panel.appendChild(controls);
  root.appendChild(panel);
}

