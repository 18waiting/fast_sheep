// SHEEP-046 error-state pattern — thin helper (DP-46).
// DP-43 ERROR_PLACEMENT_FOLLOWS_FAILURE_SCOPE: inline (action/field) / section /
//   workspace (global banner) only. DP-10: copy describes impact +
//   recovery; no raw implementation details exposed. DP-47:
//   failure contained to affected scope (AI/optional-context failure must not
//   block Conversation / source facts / manual workflow).
import { el } from "../dom.js";

export type ErrorScope = "inline" | "section" | "workspace";

export interface ErrorStateOptions {
  scope: ErrorScope;
  message: string;
  retry?: { label: string; onClick: () => void };
}

export function errorState(options: ErrorStateOptions): HTMLElement {
  const root = el("div", "fs-state fs-state--error fs-state--" + options.scope);
  root.setAttribute("role", "alert");
  if (options.scope === "workspace") root.appendChild(el("span", "fs-text--label fs-state-error-label", "错误:"));
  root.appendChild(el("p", "fs-text--body fs-state-error-message", options.message));
  if (options.retry) {
    const btn = el("button", "fs-action fs-action--secondary fs-state-action", options.retry.label) as HTMLButtonElement;
    btn.type = "button";
    btn.addEventListener("click", options.retry.onClick);
    root.appendChild(btn);
  }
  return root;
}