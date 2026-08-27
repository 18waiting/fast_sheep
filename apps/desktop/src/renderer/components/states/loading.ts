// SHEEP-046 loading-state pattern — thin helper (DP-46).
// DP-42 QUIET_TEXTUAL_PROGRESS_WITH_OPTIONAL_MINIMAL_INDICATOR: quiet text +
//   optional minimal indicator; no flashy motion; never fake unknown progress.
//   Loading is NOT primarily a Status Badge. Text-first (DP-11).
import { el } from "../dom.js";

export interface LoadingStateOptions {
  label: string;
  indicator?: boolean;
}

export function loadingState(options: LoadingStateOptions): HTMLElement {
  const root = el("div", "fs-state fs-state--loading");
  root.setAttribute("role", "status");
  root.appendChild(el("span", "fs-text--body fs-state-label", options.label));
  if (options.indicator !== false) root.appendChild(el("span", "fs-state-indicator", "…"));
  return root;
}