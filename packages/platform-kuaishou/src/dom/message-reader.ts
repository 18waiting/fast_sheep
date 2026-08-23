// M8 Kuaishou message reader (clean-room).
import { readMessages } from "@fastwork/platform-web-common";
import type { DomDocument, RawDomMessage } from "@fastwork/platform-web-common";
import { KUAISHOU_SELECTOR_PROFILE } from "./selector-registry.js";

export function readKuaishouMessages(doc: DomDocument): RawDomMessage[] {
  return readMessages(doc, KUAISHOU_SELECTOR_PROFILE);
}
