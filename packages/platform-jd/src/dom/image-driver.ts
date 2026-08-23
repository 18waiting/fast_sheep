// M8 JD image driver (clean-room). Capability-gated by the adapter.
import { domSendImage } from "@fastwork/platform-web-common";
import type { DomDocument, SendResult } from "@fastwork/platform-web-common";
import { JD_SELECTOR_PROFILE } from "./selector-registry.js";

export function jdImageDriver(doc: DomDocument, conversationId: string, assetRef: string): SendResult {
  return domSendImage(doc, JD_SELECTOR_PROFILE, conversationId, assetRef);
}
