// SHEEP-045 action primitive — thin DOM helper + semantic class contract (no framework).
// DP-35: ACTION_PROMINENCE_AND_INTENT_ARE_ORTHOGONAL.
//   prominence: primary | secondary | quiet (minimal set; no unneeded extra levels)
//   intent: default | destructive (independent axis; destructive != status-danger)
// Interaction state (default/hover/focus/pressed/disabled) lives in CSS, separated from
// business/status semantics; no business-status colored button system.
// DP-40: real actions keep native <button> semantics (native control only).
import { el } from "../dom.js";

export type ActionProminence = "primary" | "secondary" | "quiet";
export type ActionIntent = "default" | "destructive";

export interface ActionOptions {
  label: string;
  prominence?: ActionProminence;
  intent?: ActionIntent;
  disabled?: boolean;
  onClick?: () => void;
}

export function actionButton(options: ActionOptions): HTMLButtonElement {
  const classes = ["fs-action", "fs-action--" + (options.prominence ?? "secondary")];
  if (options.intent === "destructive") classes.push("fs-action--destructive");
  const b = el("button", classes.join(" "), options.label) as HTMLButtonElement;
  b.type = "button";
  if (options.disabled) b.disabled = true;
  if (options.onClick) b.addEventListener("click", options.onClick);
  return b;
}