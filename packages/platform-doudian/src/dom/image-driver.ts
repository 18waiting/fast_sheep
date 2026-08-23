// M8 Doudian image driver (clean-room). Capability-gated by the adapter.
import { domSendImage } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function doudianImageDriver(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, DOUDIAN_SELECTOR_PROFILE, conversationId, assetRef);
}
