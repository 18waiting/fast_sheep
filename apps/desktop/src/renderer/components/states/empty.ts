// SHEEP-046 empty-state pattern — thin helper (DP-46, no mega component).
// DP-41 MINIMAL_PRESENTATION_FAMILIES_WITH_EXPLICIT_STATE_MEANING: Empty is a
//   presentation family; meaning distinguishes no-work / no-result / not-configured /
//   not-yet-created. Condition/impact first; action only when truly actionable
//   (no default CTA). Text-first (DP-11). Absence must not conceal denial /
//   unavailability / not-configured (DP-48) — meaning is explicit via data-state-meaning.
import { el } from "../dom.js";

export type EmptyMeaning = "no-work" | "no-result" | "not-configured" | "not-yet-created";

export interface EmptyStateOptions {
  meaning: EmptyMeaning;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

export function emptyState(options: EmptyStateOptions): HTMLElement {
  const root = el("div", "fs-state fs-state--empty");
  root.setAttribute("data-state-meaning", options.meaning);
  root.appendChild(el("div", "fs-text--section-title fs-state-title", options.title));
  root.appendChild(el("p", "fs-text--body fs-state-body", options.body));
  if (options.action) {
    const btn = el("button", "fs-action fs-action--secondary fs-state-action", options.action.label) as HTMLButtonElement;
    btn.type = "button";
    btn.addEventListener("click", options.action.onClick);
    root.appendChild(btn);
  }
  return root;
}