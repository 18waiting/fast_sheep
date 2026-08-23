// M8 JD message reader (clean-room).
import { readMessages } from "@fastwork/platform-web-common";
import type { DomDocument, RawDomMessage } from "@fastwork/platform-web-common";
import { JD_SELECTOR_PROFILE } from "./selector-registry.js";

export function readJDMessages(doc: DomDocument): RawDomMessage[] {
  return readMessages(doc, JD_SELECTOR_PROFILE);
}
