// M8 Xianyu conversation reader (clean-room).
import { readConversation, listConversations, type ConversationRead } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { XIANYU_SELECTOR_PROFILE } from "./selector-registry.js";

export function readXianyuConversation(doc: DomDocument): ConversationRead {
  return readConversation(doc, XIANYU_SELECTOR_PROFILE);
}

export function listXianyuConversations(doc: DomDocument) {
  return listConversations(doc, XIANYU_SELECTOR_PROFILE);
}
