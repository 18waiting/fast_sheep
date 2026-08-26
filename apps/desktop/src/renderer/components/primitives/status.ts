// SHEEP-045 status/badge primitives — thin DOM helpers + semantic class contracts.
// DP-36: MINIMAL_SEMANTIC_PRIMITIVE_SET. Badge presentation is SEPARATED from Status
//   semantics (no single all-purpose status badge component).
// DP-27: canonical status roles = neutral/info/success/warning/danger.
import { el } from "../dom.js";

export type StatusRole = "neutral" | "info" | "success" | "warning" | "danger";

export function statusMarker(role: StatusRole, text: string): HTMLElement {
  return el("span", "fs-status fs-status--" + role, text);
}

export function badge(text: string, extraClass?: string): HTMLElement {
  return el("span", ["fs-badge", extraClass ?? ""].filter(Boolean).join(" "), text);
}