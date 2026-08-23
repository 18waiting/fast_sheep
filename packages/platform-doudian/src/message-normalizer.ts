// M8 Doudian message normalization (clean-room). Canonical contract via common.
export { normalizeMessage, fallbackFingerprint, type NormalizeInput } from "@fastwork/platform-web-common";
import { normalizeMessage, type NormalizeInput } from "@fastwork/platform-web-common";
import type { NormalizedInboundMessage } from "@fastwork/platform-web-common";

export function normalizeDoudianMessage(input: Omit<NormalizeInput, "platform">): NormalizedInboundMessage {
  return normalizeMessage({ ...input, platform: "doudian" });
}
