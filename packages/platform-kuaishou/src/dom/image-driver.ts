// M8 Kuaishou image driver (clean-room). Capability-gated by the adapter.
import { domSendImage } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { KUAISHOU_SELECTOR_PROFILE } from "./selector-registry.js";

export function kuaishouImageDriver(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, KUAISHOU_SELECTOR_PROFILE, conversationId, assetRef);
}
