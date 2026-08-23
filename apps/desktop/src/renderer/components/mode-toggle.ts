// M6 mode toggle (clean-room). Toggle -> orchestrator.set_mode via typed IPC.
// Human->full-auto with a pending suggestion preserves GF-ORCH-003 semantics in
// Main; the renderer only forwards the user intent.
import type { UiState } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import { button, clear, el } from "./dom.js";

export function renderModeToggle(root: HTMLElement, state: UiState, actions: WorkbenchActions): void {
  clear(root);
  const wrap = el("div", "mode-toggle");
  wrap.appendChild(el("span", "mode-label", "回复模式"));
  const mode = state.viewModel?.mode ?? "human_review";
  const busy = state.pendingCommand === "set_mode";
  const human = button(mode === "human_review" ? "mode-btn selected" : "mode-btn", "人工审核", () => actions.onSetMode("human_review"));
  const auto = button(mode === "full_auto" ? "mode-btn selected" : "mode-btn", "全自动", () => actions.onSetMode("full_auto"));
  human.disabled = busy;
  auto.disabled = busy;
  human.setAttribute("aria-pressed", mode === "human_review" ? "true" : "false");
  auto.setAttribute("aria-pressed", mode === "full_auto" ? "true" : "false");
  wrap.appendChild(human);
  wrap.appendChild(auto);
  root.appendChild(wrap);
}
