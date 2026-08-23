// M7 DOM health check (clean-room). Determines session readiness from the profile.
import type { DomDocument } from "./dom-types.js";
import { requiredSelectors, type SelectorProfile } from "../selector-profile.js";

export type DomHealthResult =
  | { ready: true; matched: string[] }
  | { ready: false; reason: string; missing: string[] };

export function domHealth(doc: DomDocument, profile: SelectorProfile): DomHealthResult {
  const missing: string[] = [];
  const matched: string[] = [];
  for (const entry of requiredSelectors(profile)) {
    const found = doc.querySelector(entry.primary) ?? (entry.fallbacks ?? []).map((f) => doc.querySelector(f)).find(Boolean) ?? null;
    if (found) matched.push(entry.key);
    else missing.push(entry.key);
  }
  if (missing.length > 0) {
    return { ready: false, reason: "DOM_UNSUPPORTED", missing };
  }
  return { ready: true, matched };
}
