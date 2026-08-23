// M8 Doudian conversation reader (clean-room).
import { readConversation, listConversations, type ConversationRead } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function readDoudianConversation(doc: DomDocument): ConversationRead {
  return readConversation(doc, DOUDIAN_SELECTOR_PROFILE);
}

export function listDoudianConversations(doc: DomDocument) {
  return listConversations(doc, DOUDIAN_SELECTOR_PROFILE);
}
