// M8 Doudian DOM selector registry (clean-room). Centralized synthetic profile.
import { syntheticProfile, type SelectorProfile } from "@fastwork/platform-web-common";

export const DOUDIAN_SELECTOR_PROFILE: SelectorProfile = syntheticProfile("doudian", "doudian-dom-1.0.0");

export function doudianProfile(): SelectorProfile {
  return DOUDIAN_SELECTOR_PROFILE;
}
