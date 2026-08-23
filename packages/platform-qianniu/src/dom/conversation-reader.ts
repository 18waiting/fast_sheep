// M8 Qianniu conversation reader (clean-room).
import { readConversation, listConversations, type ConversationRead } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "./selector-registry.js";

export function readQianniuConversation(doc: DomDocument): ConversationRead {
  return readConversation(doc, QIANNIU_SELECTOR_PROFILE);
}

export function listQianniuConversations(doc: DomDocument) {
  return listConversations(doc, QIANNIU_SELECTOR_PROFILE);
}
