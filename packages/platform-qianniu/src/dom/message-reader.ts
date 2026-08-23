// M8 Qianniu message reader (clean-room).
import { readMessages } from "@fastwork/platform-web-common";
import type { DomDocument, RawDomMessage } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "./selector-registry.js";

export function readQianniuMessages(doc: DomDocument): RawDomMessage[] {
  return readMessages(doc, QIANNIU_SELECTOR_PROFILE);
}
