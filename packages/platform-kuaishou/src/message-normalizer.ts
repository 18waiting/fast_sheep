// M8 Kuaishou message normalization (clean-room). Canonical contract via common.
export { normalizeMessage, fallbackFingerprint, type NormalizeInput } from "@fastwork/platform-web-common";
import { normalizeMessage, type NormalizeInput } from "@fastwork/platform-web-common";
import type { NormalizedInboundMessage } from "@fastwork/platform-web-common";

export function normalizeKuaishouMessage(input: Omit<NormalizeInput, "platform">): NormalizedInboundMessage {
  return normalizeMessage({ ...input, platform: "kuaishou" });
}
