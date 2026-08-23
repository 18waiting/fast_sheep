// M8 JD conversation reader (clean-room).
import { readConversation, listConversations, type ConversationRead } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { JD_SELECTOR_PROFILE } from "./selector-registry.js";

export function readJDConversation(doc: DomDocument): ConversationRead {
  return readConversation(doc, JD_SELECTOR_PROFILE);
}

export function listJDConversations(doc: DomDocument) {
  return listConversations(doc, JD_SELECTOR_PROFILE);
}
