// M8 Xianyu message reader (clean-room).
import { readMessages } from "@fastwork/platform-web-common";
import type { DomDocument, RawDomMessage } from "@fastwork/platform-web-common";
import { XIANYU_SELECTOR_PROFILE } from "./selector-registry.js";

export function readXianyuMessages(doc: DomDocument): RawDomMessage[] {
  return readMessages(doc, XIANYU_SELECTOR_PROFILE);
}
