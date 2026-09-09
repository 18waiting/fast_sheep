// Minimal DOM surface used by the M7 DOM drivers. Structurally satisfied by both
// jsdom (tests) and the real browser Document (page runtime), so drivers run in
// Node tests and inside the sandboxed PDD preload without any DOM library import.
export interface DomElement {
  querySelector(sel: string): DomElement | null;
  querySelectorAll(sel: string): DomElement[];
  textContent: string | null;
  getAttribute(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  click?(): void;
  dispatchEvent?(event: unknown): boolean;
}

export interface DomLocationProjection {
  origin: string;
  pathname: string;
}

export interface DomDocument {
  querySelector(sel: string): DomElement | null;
  querySelectorAll(sel: string): DomElement[];
  body: DomElement;
  location?: DomLocationProjection;
}

/** Wrap a real browser Document into the minimal DomDocument surface. */
export function toDomDocument(doc: unknown): DomDocument {
  const d = doc as Document;
  return {
    querySelector: (sel) => toDomElement(d.querySelector(sel)),
    querySelectorAll: (sel) =>
      Array.from(d.querySelectorAll(sel)).map((n) => toDomElement(n)).filter((x): x is DomElement => x !== null),
    body: toDomElement(d.body) as DomElement,
    location: d.location
      ? { origin: d.location.origin, pathname: d.location.pathname }
      : undefined,
  };
}

/** Minimal structural adapter: wrap a real Element/Document into DomElement. */
export function toDomElement(node: unknown): DomElement | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  if (typeof n.querySelector !== "function" || typeof n.querySelectorAll !== "function") return null;
  return n as unknown as DomElement;
}
