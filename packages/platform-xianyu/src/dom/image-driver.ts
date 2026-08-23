// M8 Xianyu image driver (clean-room). Capability-gated by the adapter.
import { domSendImage } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { XIANYU_SELECTOR_PROFILE } from "./selector-registry.js";

export function xianyuImageDriver(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, XIANYU_SELECTOR_PROFILE, conversationId, assetRef);
}
