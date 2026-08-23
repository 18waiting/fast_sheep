// M8 JD capability matrix (clean-room). Source: spec/platforms/
// platform-adapter-matrix.md + transfer-matrix.md.
import type { PlatformCapabilities } from "@fastwork/platform-web-common";

export const JD_CAPABILITIES: PlatformCapabilities = {
  receive_text: true,
  send_text: true,
  send_image: true,
  manual_takeover_detection: true,
  conversation_selection: true,
  transfer: true,
  product_context: true,
  order_context: true,
  desktop_helper: false,
};

export const JD_CAPABILITY_CERTAINTY: Record<string, string> = {
  receive_text: "PARTIAL",
  send_text: "PARTIAL",
  send_image: "PARTIAL",
  manual_takeover_detection: "PARTIAL",
  conversation_selection: "PARTIAL",
  transfer: "PARTIAL",
  product_context: "PARTIAL",
  order_context: "PARTIAL",
  desktop_helper: "UNSUPPORTED_REFERENCE",
};

export function capabilities(): PlatformCapabilities {
  return { ...JD_CAPABILITIES };
}
