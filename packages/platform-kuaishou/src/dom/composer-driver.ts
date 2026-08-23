// M8 Kuaishou composer driver (clean-room). Exactly one segment; fails safe.
import { domSendText, domSendImage, readComposerState, type ComposerState } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { KUAISHOU_SELECTOR_PROFILE } from "./selector-registry.js";

export function kuaishouComposerState(doc: DomDocument): ComposerState {
  return readComposerState(doc, KUAISHOU_SELECTOR_PROFILE);
}

export function kuaishouSendText(doc: DomDocument, conversationId: string, text: string): SendResult {
  return domSendText(doc, KUAISHOU_SELECTOR_PROFILE, conversationId, text);
}

export function kuaishouSendImage(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, KUAISHOU_SELECTOR_PROFILE, conversationId, assetRef);
}
