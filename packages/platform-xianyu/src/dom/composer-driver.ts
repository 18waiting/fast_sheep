// M8 Xianyu composer driver (clean-room). Exactly one segment; fails safe.
import { domSendText, domSendImage, readComposerState, type ComposerState } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { XIANYU_SELECTOR_PROFILE } from "./selector-registry.js";

export function xianyuComposerState(doc: DomDocument): ComposerState {
  return readComposerState(doc, XIANYU_SELECTOR_PROFILE);
}

export function xianyuSendText(doc: DomDocument, conversationId: string, text: string): SendResult {
  return domSendText(doc, XIANYU_SELECTOR_PROFILE, conversationId, text);
}

export function xianyuSendImage(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, XIANYU_SELECTOR_PROFILE, conversationId, assetRef);
}
