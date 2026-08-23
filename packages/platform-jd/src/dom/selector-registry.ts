// M8 JD DOM selector registry (clean-room). Centralized synthetic profile.
import { syntheticProfile, type SelectorProfile } from "@fastwork/platform-web-common";

export const JD_SELECTOR_PROFILE: SelectorProfile = syntheticProfile("jd", "jd-dom-1.0.0");

export function jdProfile(): SelectorProfile {
  return JD_SELECTOR_PROFILE;
}
