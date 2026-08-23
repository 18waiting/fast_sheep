// M7 composer driver (clean-room). Sets text and triggers send on the synthetic DOM.
import type { DomDocument, DomElement } from "./dom-types.js";
import { selector, type SelectorProfile } from "../selector-profile.js";
import type { SendResult } from "../types.js";

export interface ComposerState {
  found: boolean;
  disabled: boolean;
}

export function readComposerState(doc: DomDocument, profile: SelectorProfile): ComposerState {
  const inputSel = selector(profile, "composer.input");
  if (!inputSel) return { found: false, disabled: true };
  const input = doc.querySelector(inputSel.primary) ?? inputSel.fallbacks?.map((f) => doc.querySelector(f)).find(Boolean) ?? null;
  if (!input) return { found: false, disabled: true };
  const disabledMarker = doc.querySelector(selector(profile, "composer.disabled")?.primary ?? "");
  return { found: true, disabled: disabledMarker !== null };
}

/**
 * Send exactly one already-decided text segment (never `###`-split here).
 * Browser-compatible input set + send trigger + deterministic ack.
 */
export function sendText(doc: DomDocument, profile: SelectorProfile, conversationId: string, text: string): SendResult {
  const inputSel = selector(profile, "composer.input");
  const sendSel = selector(profile, "composer.send");
  if (!inputSel || !sendSel) return { ok: false, error: "platform.dom_unavailable" };
  const input = doc.querySelector(inputSel.primary);
  const send = doc.querySelector(sendSel.primary);
  const disabled = doc.querySelector(selector(profile, "composer.disabled")?.primary ?? "");
  if (!input || !send || disabled) return { ok: false, error: "platform.dom_unavailable" };

  if (typeof input.setAttribute === "function") input.setAttribute("value", text);
  dispatchInputEvents(doc, input);
  if (typeof send.click === "function") send.click();

  // Deterministic ack from the synthetic DOM contract.
  const ack = doc.querySelector("[data-fw-pdd-send-ack]");
  return { ok: true, message_id: ack?.getAttribute("data-message-id") ?? undefined };
}

/** Send an image asset through the synthetic composer image input. */
function dispatchInputEvents(doc: DomDocument, input: DomElement): void {
  const view = (doc as unknown as { defaultView?: { Event?: new (type: string) => Event } }).defaultView;
  const EventCtor = view?.Event;
  if (!EventCtor || typeof input.dispatchEvent !== "function") return;
  try {
    input.dispatchEvent(new EventCtor("input"));
    input.dispatchEvent(new EventCtor("change"));
  } catch {
    // Input/change events are best-effort; the value set above is authoritative.
  }
}

export function sendImage(doc: DomDocument, profile: SelectorProfile, conversationId: string, assetRef: string): SendResult {
  const imageInputSel = selector(profile, "composer.image-input");
  const sendSel = selector(profile, "composer.send");
  if (!imageInputSel || !sendSel) return { ok: false, error: "platform.dom_unavailable" };
  const imageInput = doc.querySelector(imageInputSel.primary);
  const send = doc.querySelector(sendSel.primary);
  if (!imageInput || !send) return { ok: false, error: "platform.dom_unavailable" };
  if (typeof imageInput.setAttribute === "function") imageInput.setAttribute("data-asset-ref", assetRef);
  if (typeof send.click === "function") send.click();
  return { ok: true };
}
