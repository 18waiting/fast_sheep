// M7 message reader (clean-room). Reads raw message candidates from the transcript.
import type { DomDocument, DomElement } from "./dom-types.js";
import { selector, type SelectorProfile } from "../selector-profile.js";
import type { RawDomMessage } from "../types.js";

export function readMessages(doc: DomDocument, profile: SelectorProfile): RawDomMessage[] {
  const rowSel = selector(profile, "message.row");
  const contentSel = selector(profile, "message.content");
  const buyerSel = selector(profile, "message.buyer");
  if (!rowSel || !contentSel) return [];
  const out: RawDomMessage[] = [];
  const rows = doc.querySelectorAll(rowSel.primary);
  for (const row of rows) {
    const contentEl = contentSel.primary ? row.querySelector(contentSel.primary) : null;
    const content = contentEl?.textContent?.trim() ?? "";
    if (!content) continue;
    const dir = row.getAttribute("data-direction");
    out.push({
      unread: row.getAttribute("data-unread") === "true",
      direction: dir === "outbound" ? "outbound" : dir === "inbound" ? "inbound" : undefined,
      buyer: buyerSel?.primary ? row.querySelector(buyerSel.primary)?.textContent?.trim() || undefined : undefined,
      content,
      platform_message_id: row.getAttribute("data-message-id") ?? undefined,
      timestamp: row.getAttribute("data-ts") ?? undefined,
      product_context: readContextBlock(doc, profile, "product.context"),
      order_context: readContextBlock(doc, profile, "order.context"),
    });
  }
  return out;
}

function readContextBlock(doc: DomDocument, profile: SelectorProfile, key: string): Record<string, unknown> | undefined {
  const entry = selector(profile, key);
  if (!entry) return undefined;
  const node = doc.querySelector(entry.primary);
  if (!node) return undefined;
  return { block: node.textContent?.trim()?.slice(0, 200) ?? "" };
}
