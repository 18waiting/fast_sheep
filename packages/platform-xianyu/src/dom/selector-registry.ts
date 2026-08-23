// M8 Xianyu DOM selector registry (clean-room). Centralized synthetic profile.
import { syntheticProfile, type SelectorProfile } from "@fastwork/platform-web-common";

export const XIANYU_SELECTOR_PROFILE: SelectorProfile = syntheticProfile("xianyu", "xianyu-dom-1.0.0");

export function xianyuProfile(): SelectorProfile {
  return XIANYU_SELECTOR_PROFILE;
}
