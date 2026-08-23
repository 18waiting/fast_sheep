// M6 countdown view (clean-room).
// Display-only: the renderer is NOT an authoritative timer and MUST NOT trigger
// sending. Actual send ownership stays in the M5 CountdownController (Main).
// Visual zero alone can never send from the renderer.
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";

/** Pure display formatting for the Main-supplied countdown projection. */
export function formatCountdown(remainingTicks: number, tickMs: number): string {
  const totalMs = Math.max(0, remainingTicks) * Math.max(0, tickMs);
  const seconds = Math.ceil(totalMs / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function renderCountdownView(root: HTMLElement, state: UiState): void {
  clear(root);
  const cd = state.viewModel?.countdown;
  const wrap = el("div", "countdown-view");
  if (!cd || !cd.enabled) {
    wrap.appendChild(el("span", "countdown-label", "倒计时: 未启用"));
    root.appendChild(wrap);
    return;
  }
  wrap.appendChild(el("span", "countdown-label", "倒计时(展示):"));
  wrap.appendChild(el("span", "countdown-value", formatCountdown(cd.remaining_ticks, cd.tick_ms)));
  wrap.appendChild(el("span", "countdown-note", "由 Main 权威下发，仅作展示"));
  root.appendChild(wrap);
}
