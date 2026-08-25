// SHEEP-029 minimal clean-room dialog helper.
// Reference evidence confirms a modal/dialog STRUCTURE exists (add-shop modal in the
// reference sidebar shell, SHEEP-022) but NOT a unified dialog framework. This is a
// minimal, replaceable helper only: overlay + panel + title + close button + content.
// Close button is structural semantics only; keyboard/overlay-click/focus-management/
// motion behaviors are not implemented (UNKNOWN/DEFERRED). Styles reuse existing
// --fs-* tokens only; no new unproven visual values. API stability = NOT_ESTABLISHED
// (first real consumer may adjust per evidence; not a permanent Design System contract).
import { button, clear, el } from "./dom.js";

export interface DialogParts {
  overlay: HTMLElement;
  panel: HTMLElement;
  title: HTMLElement;
  closeButton: HTMLButtonElement;
  content: HTMLElement;
}

export function renderDialog(host: HTMLElement, title: string): DialogParts {
  clear(host);

  const overlay = el("div", "dialog-overlay");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const panel = el("div", "dialog-panel");
  const header = el("div", "dialog-header");
  const titleEl = el("h2", "dialog-title", title);
  const closeButton = button("btn dialog-close", "关闭", () => {});
  header.appendChild(titleEl);
  header.appendChild(closeButton);
  panel.appendChild(header);

  const content = el("div", "dialog-content");
  panel.appendChild(content);

  overlay.appendChild(panel);
  host.appendChild(overlay);

  return { overlay, panel, title: titleEl, closeButton, content };
}