// M8 Qianniu image driver (clean-room). Capability-gated by the adapter.
import { domSendImage } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "./selector-registry.js";

export function qianniuImageDriver(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, QIANNIU_SELECTOR_PROFILE, conversationId, assetRef);
}
