// M7 PDD DOM selector registry (clean-room). Centralized DOM-side access to the
// versioned SelectorProfile; no selector strings are scattered in DOM code.
import { PDD_SELECTOR_PROFILE, selector, type SelectorEntry, type SelectorProfile } from "../selector-profile.js";

export function selectorRegistry(): SelectorProfile {
  return PDD_SELECTOR_PROFILE;
}

export function domSelector(profile: SelectorProfile, key: string): SelectorEntry | undefined {
  return selector(profile, key);
}

export function profileVersion(): string {
  return PDD_SELECTOR_PROFILE.version;
}
