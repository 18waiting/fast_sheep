// M8 generic DOM drivers (platform-neutral; parameterized by SelectorProfile).
import type { DomDocument, DomElement, RawDomMessage, SendResult, TransferExecutionResult, AutomatedSendAck, ConversationRead, ComposerState } from "./types.js";

/** Wrap a real browser Document into the minimal DomDocument surface. */
export function toDomDocument(doc: unknown): DomDocument {
  const d = doc as Document;
  return {
    querySelector: (sel) => toDomElement(d.querySelector(sel)),
    querySelectorAll: (sel) => Array.from(d.querySelectorAll(sel)).map((n) => toDomElement(n)).filter((x): x is DomElement => x !== null),
    body: toDomElement(d.body) as DomElement,
  };
}

function toDomElement(node: unknown): DomElement | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  if (typeof n.querySelector !== "function" || typeof n.querySelectorAll !== "function") return null;
  return n as unknown as DomElement;
}
import { selector, requiredSelectors, type SelectorProfile } from "./selector-profile.js";
import { PLATFORM_ERROR_CODES } from "./errors.js";

export type DomHealthResult = { ready: true; matched: string[] } | { ready: false; reason: string; missing: string[] };

export function domHealth(doc: DomDocument, profile: SelectorProfile): DomHealthResult {
  const missing: string[] = [];
  const matched: string[] = [];
  for (const entry of requiredSelectors(profile)) {
    const found = doc.querySelector(entry.primary) ?? (entry.fallbacks ?? []).map((f) => doc.querySelector(f)).find(Boolean) ?? null;
    if (found) matched.push(entry.key);
    else missing.push(entry.key);
  }
  if (missing.length > 0) return { ready: false, reason: "DOM_UNSUPPORTED", missing };
  return { ready: true, matched };
}

export function readConversation(doc: DomDocument, profile: SelectorProfile): ConversationRead {
  const itemSel = selector(profile, "conversation.active") ?? selector(profile, "conversation.item");
  if (!itemSel) return { conversation_id: null };
  let active = doc.querySelector(itemSel.primary);
  if (!active && itemSel.fallbacks?.length) active = doc.querySelector(itemSel.fallbacks[0]);
  if (!active) return { conversation_id: null };
  const buyerSel = selector(profile, "message.buyer");
  return {
    conversation_id: active.getAttribute("data-conversation-id"),
    buyer_id: active.getAttribute("data-buyer-id") ?? undefined,
    buyer: buyerSel?.primary ? doc.querySelector(buyerSel.primary)?.textContent?.trim() || undefined : undefined,
  };
}

export function listConversations(doc: DomDocument, profile: SelectorProfile): Array<{ id: string; active: boolean; buyer?: string }> {
  const itemSel = selector(profile, "conversation.item");
  if (!itemSel) return [];
  const out: Array<{ id: string; active: boolean; buyer?: string }> = [];
  for (const node of doc.querySelectorAll(itemSel.primary)) {
    const id = node.getAttribute("data-conversation-id");
    if (!id) continue;
    out.push({ id, active: node.getAttribute("data-active") === "true", buyer: node.getAttribute("data-buyer") ?? undefined });
  }
  return out;
}

export function readMessages(doc: DomDocument, profile: SelectorProfile): RawDomMessage[] {
  const rowSel = selector(profile, "message.row");
  const contentSel = selector(profile, "message.content");
  const buyerSel = selector(profile, "message.buyer");
  if (!rowSel || !contentSel) return [];
  const out: RawDomMessage[] = [];
  for (const row of doc.querySelectorAll(rowSel.primary)) {
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

export function readComposerState(doc: DomDocument, profile: SelectorProfile): ComposerState {
  const inputSel = selector(profile, "composer.input");
  if (!inputSel) return { found: false, disabled: true };
  const input = doc.querySelector(inputSel.primary) ?? inputSel.fallbacks?.map((f) => doc.querySelector(f)).find(Boolean) ?? null;
  if (!input) return { found: false, disabled: true };
  const disabledMarker = doc.querySelector(selector(profile, "composer.disabled")?.primary ?? "");
  return { found: true, disabled: disabledMarker !== null };
}

function dispatchInputEvents(doc: DomDocument, input: DomElement): void {
  const view = (doc as unknown as { defaultView?: { Event?: new (type: string) => Event } }).defaultView;
  const EventCtor = view?.Event;
  if (!EventCtor || typeof input.dispatchEvent !== "function") return;
  try {
    input.dispatchEvent(new EventCtor("input"));
    input.dispatchEvent(new EventCtor("change"));
  } catch {
    // best-effort
  }
}

export function sendText(doc: DomDocument, profile: SelectorProfile, conversationId: string, text: string): SendResult {
  const inputSel = selector(profile, "composer.input");
  const sendSel = selector(profile, "composer.send");
  if (!inputSel || !sendSel) return { ok: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  const input = doc.querySelector(inputSel.primary);
  const send = doc.querySelector(sendSel.primary);
  const disabled = doc.querySelector(selector(profile, "composer.disabled")?.primary ?? "");
  if (!input || !send || disabled) return { ok: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  if (typeof input.setAttribute === "function") input.setAttribute("value", text);
  dispatchInputEvents(doc, input);
  if (typeof send.click === "function") send.click();
  const ack = doc.querySelector("[data-fw-" + profile.platform + "-send-ack]");
  return { ok: true, message_id: ack?.getAttribute("data-message-id") ?? undefined };
}

export function sendImage(doc: DomDocument, profile: SelectorProfile, conversationId: string, assetRef: string): SendResult {
  const imageInputSel = selector(profile, "composer.image-input");
  const sendSel = selector(profile, "composer.send");
  if (!imageInputSel || !sendSel) return { ok: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  const imageInput = doc.querySelector(imageInputSel.primary);
  const send = doc.querySelector(sendSel.primary);
  if (!imageInput || !send) return { ok: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  if (typeof imageInput.setAttribute === "function") imageInput.setAttribute("data-asset-ref", assetRef);
  if (typeof send.click === "function") send.click();
  return { ok: true };
}

export function detectHumanReply(
  doc: DomDocument,
  profile: SelectorProfile,
  messages: RawDomMessage[],
  recentAutomatedAcks: AutomatedSendAck[],
  nowMs: number,
  expiryMs = 60_000,
): { isHuman: boolean; message_id?: string } {
  const ackIds = new Set(recentAutomatedAcks.filter((a) => nowMs - a.at_ms <= expiryMs).map((a) => a.message_id));
  const rowSel = selector(profile, "message.row");
  if (!rowSel) return { isHuman: false };
  for (const row of doc.querySelectorAll(rowSel.primary)) {
    const direction = row.getAttribute("data-direction");
    if (direction !== "outbound") continue;
    const mid = row.getAttribute("data-message-id");
    if (mid && ackIds.has(mid)) continue;
    return { isHuman: true, message_id: mid ?? undefined };
  }
  void messages;
  return { isHuman: false };
}

export function executeTransfer(doc: DomDocument, profile: SelectorProfile, target: string): TransferExecutionResult {
  const openSel = selector(profile, "transfer.open");
  const targetListSel = selector(profile, "transfer.target-list");
  const targetItemSel = selector(profile, "transfer.target-item");
  const confirmSel = selector(profile, "transfer.confirm");
  if (!openSel || !targetListSel || !targetItemSel || !confirmSel) {
    return { ok: false, executed: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  }
  const open = doc.querySelector(openSel.primary);
  const targetList = doc.querySelector(targetListSel.primary);
  if (!open || !targetList) return { ok: false, executed: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  if (typeof open.click === "function") open.click();
  const targetListAfterOpen = doc.querySelector(targetListSel.primary) ?? targetList;
  let targetNode: DomElement | null = null;
  for (const node of targetListAfterOpen.querySelectorAll(targetItemSel.primary)) {
    if (node.getAttribute("data-target") === target || node.textContent?.trim() === target) {
      targetNode = node;
      break;
    }
  }
  if (!targetNode) {
    return { ok: false, executed: false, error: PLATFORM_ERROR_CODES.TRANSFER_TARGET_UNAVAILABLE, fallback_message: FALLBACK_TRANSFER_TEXT };
  }
  if (typeof targetNode.click === "function") targetNode.click();
  const confirm = doc.querySelector(confirmSel.primary);
  if (!confirm) return { ok: false, executed: false, error: PLATFORM_ERROR_CODES.DOM_UNAVAILABLE };
  if (typeof confirm.click === "function") confirm.click();
  return { ok: true, executed: true };
}

/** 转接放弃话术 fallback (matches frozen fixture token). */
export const FALLBACK_TRANSFER_TEXT = "<转接放弃话术>";
