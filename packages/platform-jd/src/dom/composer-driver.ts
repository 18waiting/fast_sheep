// M8 JD composer driver (clean-room). Exactly one segment; fails safe.
import { domSendText, domSendImage, readComposerState, type ComposerState } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { JD_SELECTOR_PROFILE } from "./selector-registry.js";

export function jdComposerState(doc: DomDocument): ComposerState {
  return readComposerState(doc, JD_SELECTOR_PROFILE);
}

export function jdSendText(doc: DomDocument, conversationId: string, text: string): SendResult {
  return domSendText(doc, JD_SELECTOR_PROFILE, conversationId, text);
}

export function jdSendImage(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, JD_SELECTOR_PROFILE, conversationId, assetRef);
}
