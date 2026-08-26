// SHEEP-045 text-role primitive — thin DOM helper + semantic class contract (no framework).
// DP-37: SEMANTIC_TEXT_ROLES_NOT_NUMERIC_HEADING_LEVELS.
// Roles: work-object-title / section-title / component-title / body / label / metadata.
// Visual text roles do NOT lock HTML heading levels (h1-h6 mapping = SHEEP-047).
import { el } from "../dom.js";

export type TextRole =
  | "work-object-title"
  | "section-title"
  | "component-title"
  | "body"
  | "label"
  | "metadata";

export function textRole(role: TextRole, text: string, tag: keyof HTMLElementTagNameMap = "div"): HTMLElement {
  return el(tag, "fs-text fs-text--" + role, text);
}