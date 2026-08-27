// M6 error banner (clean-room) — SHEEP-046 migration: workspace-scope error pattern.
// Shows only the sanitized Main-supplied error; copy describes impact (DP-10/DP-43).
import type { UiState } from "../state/view-model.js";
import { clear } from "./dom.js";
import { errorState } from "./states/error.js";

export function renderErrorBanner(root: HTMLElement, state: UiState): void {
  clear(root);
  if (!state.lastError && !state.viewModel?.last_error) return;
  const message = state.lastError ?? state.viewModel?.last_error ?? "";
  root.appendChild(errorState({ scope: "workspace", message: message.slice(0, 200) })); // safe
}
