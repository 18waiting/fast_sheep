// M8 platform-web-common capabilities helper (platform-neutral).
import type { PlatformCapabilities } from "./types.js";
import { PLATFORM_ERROR_CODES } from "./errors.js";

export function isCapabilitySupported(caps: PlatformCapabilities, name: string): boolean {
  return caps[name] === true;
}

export function unsupportedError(): { ok: false; error: string } {
  return { ok: false, error: PLATFORM_ERROR_CODES.UNSUPPORTED_CAPABILITY };
}

/** Type-level capability source classification per platform. */
export interface CapabilityClaim {
  capability: string;
  supported: boolean;
  certainty: "CONFIRMED" | "PARTIAL" | "DESIGN" | "UNKNOWN";
  source_classification: "SUPPORTED_REFERENCE" | "PARTIAL" | "UNSUPPORTED_REFERENCE" | "DESIGN" | "UNKNOWN";
}
