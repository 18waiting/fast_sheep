// M8 Kuaishou DOM selector registry (clean-room). Centralized synthetic profile.
import { syntheticProfile, type SelectorProfile } from "@fastwork/platform-web-common";

export const KUAISHOU_SELECTOR_PROFILE: SelectorProfile = syntheticProfile("kuaishou", "kuaishou-dom-1.0.0");

export function kuaishouProfile(): SelectorProfile {
  return KUAISHOU_SELECTOR_PROFILE;
}
