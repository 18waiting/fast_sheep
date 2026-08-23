// M8 Doudian composer driver (clean-room). Exactly one segment; fails safe.
import { domSendText, domSendImage, readComposerState, type ComposerState } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function doudianComposerState(doc: DomDocument): ComposerState {
  return readComposerState(doc, DOUDIAN_SELECTOR_PROFILE);
}

export function doudianSendText(doc: DomDocument, conversationId: string, text: string): SendResult {
  return domSendText(doc, DOUDIAN_SELECTOR_PROFILE, conversationId, text);
}

export function doudianSendImage(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, DOUDIAN_SELECTOR_PROFILE, conversationId, assetRef);
}
