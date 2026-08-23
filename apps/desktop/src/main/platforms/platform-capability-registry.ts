// M8 platform capability registry (clean-room). Reads capabilities declared by
// each platform package. The renderer never derives capabilities from the
// platform string alone.
import type { PlatformCapabilities } from "@fastwork/platform-web-common";
import { DOUDIAN_CAPABILITIES } from "@fastwork/platform-doudian";
import { JD_CAPABILITIES } from "@fastwork/platform-jd";
import { KUAISHOU_CAPABILITIES } from "@fastwork/platform-kuaishou";
import { QIANNIU_CAPABILITIES } from "@fastwork/platform-qianniu";
import { XIANYU_CAPABILITIES } from "@fastwork/platform-xianyu";
import type { PlatformId } from "./platform-host-registry.js";

const PDD_CAPABILITIES: PlatformCapabilities = {
  receive_text: true, send_text: true, send_image: true, manual_takeover_detection: true,
  conversation_selection: true, transfer: true, product_context: true, order_context: true, desktop_helper: false,
};

const DECLARED: Record<PlatformId, PlatformCapabilities> = {
  pdd: PDD_CAPABILITIES,
  doudian: DOUDIAN_CAPABILITIES,
  jd: JD_CAPABILITIES,
  kuaishou: KUAISHOU_CAPABILITIES,
  qianniu: QIANNIU_CAPABILITIES,
  xianyu: XIANYU_CAPABILITIES,
};

export function capabilitiesFor(platform: PlatformId): PlatformCapabilities {
  return { ...(DECLARED[platform] ?? { receive_text: false, send_text: false, send_image: false, manual_takeover_detection: false, conversation_selection: false, transfer: false }) };
}
