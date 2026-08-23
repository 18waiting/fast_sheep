// M8 Xianyu capability matrix (clean-room). Source: spec/platforms/
// platform-adapter-matrix.md + transfer-matrix.md.
import type { PlatformCapabilities } from "@fastwork/platform-web-common";

export const XIANYU_CAPABILITIES: PlatformCapabilities = {
  receive_text: true,
  send_text: true,
  send_image: true,
  manual_takeover_detection: true,
  conversation_selection: true,
  transfer: false,
  product_context: true,
  order_context: false,
  desktop_helper: false,
};

export const XIANYU_CAPABILITY_CERTAINTY: Record<string, string> = {
  receive_text: "PARTIAL",
  send_text: "PARTIAL",
  send_image: "PARTIAL",
  manual_takeover_detection: "PARTIAL",
  conversation_selection: "PARTIAL",
  transfer: "UNSUPPORTED_REFERENCE (no auto transfer)",
  product_context: "PARTIAL",
  order_context: "UNKNOWN",
  desktop_helper: "UNSUPPORTED_REFERENCE",
};

export function capabilities(): PlatformCapabilities {
  return { ...XIANYU_CAPABILITIES };
}
