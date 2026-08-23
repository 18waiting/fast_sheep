// M7 conversation reader (clean-room). Reads the active conversation from the DOM.
import type { DomDocument, DomElement } from "./dom-types.js";
import { selector, type SelectorProfile } from "../selector-profile.js";

export interface ConversationRead {
  conversation_id: string | null;
  buyer_id?: string;
  buyer?: string;
}

export function readConversation(doc: DomDocument, profile: SelectorProfile): ConversationRead {
  const itemSel = selector(profile, "conversation.active") ?? selector(profile, "conversation.item");
  if (!itemSel) return { conversation_id: null };
  let active = doc.querySelector(itemSel.primary);
  if (!active && itemSel.fallbacks?.length) active = doc.querySelector(itemSel.fallbacks[0]);
  if (!active) return { conversation_id: null };
  const id = active.getAttribute("data-conversation-id");
  const buyerEl = doc.querySelector(selector(profile, "message.buyer")?.primary ?? "[data-fw-pdd-buyer-name]");
  return {
    conversation_id: id,
    buyer_id: active.getAttribute("data-buyer-id") ?? undefined,
    buyer: buyerEl?.textContent?.trim() || undefined,
  };
}

/** Deterministic list of conversations in DOM order (for switching detection). */
export function listConversations(doc: DomDocument, profile: SelectorProfile): Array<{ id: string; active: boolean; buyer?: string }> {
  const itemSel = selector(profile, "conversation.item");
  if (!itemSel) return [];
  const out: Array<{ id: string; active: boolean; buyer?: string }> = [];
  for (const node of doc.querySelectorAll(itemSel.primary)) {
    const id = node.getAttribute("data-conversation-id");
    if (!id) continue;
    out.push({
      id,
      active: node.getAttribute("data-active") === "true",
      buyer: node.getAttribute("data-buyer") ?? undefined,
    });
  }
  return out;
}
