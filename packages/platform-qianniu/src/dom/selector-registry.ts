// M8 Qianniu DOM selector registry (clean-room). Centralized synthetic profile.
import { syntheticProfile, type SelectorProfile } from "@fastwork/platform-web-common";

export const QIANNIU_SELECTOR_PROFILE: SelectorProfile = syntheticProfile("qianniu", "qianniu-dom-1.0.0");

export function qianniuProfile(): SelectorProfile {
  return QIANNIU_SELECTOR_PROFILE;
}
