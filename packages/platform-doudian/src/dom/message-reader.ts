// M8 Doudian message reader (clean-room).
import { readMessages } from "@fastwork/platform-web-common";
import type { DomDocument, RawDomMessage } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function readDoudianMessages(doc: DomDocument): RawDomMessage[] {
  return readMessages(doc, DOUDIAN_SELECTOR_PROFILE);
}
