// M6 renderer DOM helpers (clean-room).
// Untrusted customer text is always rendered via textContent; raw innerHTML is
// never used for customer/business data.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(root: HTMLElement): void {
  while (root.firstChild) root.removeChild(root.firstChild);
}

export function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
