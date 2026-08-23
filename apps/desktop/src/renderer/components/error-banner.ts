// M6 error banner (clean-room). Shows only the sanitized Main-supplied error.
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";

export function renderErrorBanner(root: HTMLElement, state: UiState): void {
  clear(root);
  if (!state.lastError && !state.viewModel?.last_error) return;
  const message = state.lastError ?? state.viewModel?.last_error ?? "";
  const banner = el("div", "error-banner");
  banner.setAttribute("role", "alert");
  const label = el("span", "error-label", "错误:");
  const text = el("span", "error-text");
  text.textContent = message.slice(0, 200); // safe
  banner.appendChild(label);
  banner.appendChild(text);
  root.appendChild(banner);
}
