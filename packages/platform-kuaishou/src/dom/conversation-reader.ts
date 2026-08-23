// M8 Kuaishou conversation reader (clean-room).
import { readConversation, listConversations, type ConversationRead } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { KUAISHOU_SELECTOR_PROFILE } from "./selector-registry.js";

export function readKuaishouConversation(doc: DomDocument): ConversationRead {
  return readConversation(doc, KUAISHOU_SELECTOR_PROFILE);
}

export function listKuaishouConversations(doc: DomDocument) {
  return listConversations(doc, KUAISHOU_SELECTOR_PROFILE);
}
