// Platform capability registry (clean-room). Reads capabilities declared by the
// owning platform package. The renderer never derives capabilities from the
// platform string alone.
// FastWork realignment B3: PDD is the only canonical platform. The capability
// matrix type lives in @fastwork/contracts (fastwork:platform:platform-capabilities),
// which is the surviving single source of truth.
import type { M8PlatformCapabilities as PlatformCapabilities } from "@fastwork/contracts";
import { PDD_CAPABILITIES as PDD_DECLARED_CAPABILITIES } from "@fastwork/platform-pdd";
import type { PlatformId } from "./platform-host-registry.js";

export type { PlatformCapabilities };

/** Unknown platform ids fail closed: no capability is silently promoted. */
const FAIL_CLOSED_CAPABILITIES: PlatformCapabilities = {
  receive_text: false,
  send_text: false,
  send_image: false,
  manual_takeover_detection: false,
  conversation_selection: false,
  transfer: false,
  product_context: false,
  order_context: false,
  desktop_helper: false,
};

const DECLARED: Record<PlatformId, PlatformCapabilities> = {
  pdd: { ...PDD_DECLARED_CAPABILITIES },
};

export function capabilitiesFor(platform: PlatformId): PlatformCapabilities {
  return { ...(DECLARED[platform] ?? FAIL_CLOSED_CAPABILITIES) };
}
