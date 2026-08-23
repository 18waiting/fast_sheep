// M8 Qianniu composer driver (clean-room). Exactly one segment; fails safe.
import { domSendText, domSendImage, readComposerState, type ComposerState } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "./selector-registry.js";

export function qianniuComposerState(doc: DomDocument): ComposerState {
  return readComposerState(doc, QIANNIU_SELECTOR_PROFILE);
}

export function qianniuSendText(doc: DomDocument, conversationId: string, text: string): SendResult {
  return domSendText(doc, QIANNIU_SELECTOR_PROFILE, conversationId, text);
}

export function qianniuSendImage(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, QIANNIU_SELECTOR_PROFILE, conversationId, assetRef);
}
