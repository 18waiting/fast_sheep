// Platform host registry (clean-room). Maps the canonical platform ids to
// host/service factories. No scattered switch statements.
// FastWork realignment B3: the MVP is PDD-only, so the registry declares a
// single canonical platform. Re-adding a platform is a governance decision,
// not a switch-statement edit.
import type { PddPlatformService } from "./pdd/pdd-platform-service.js";

export const PLATFORM_IDS = ["pdd"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export type PlatformHostService = PddPlatformService;

export interface PlatformHostEntry {
  platform: PlatformId;
  kind: "pdd";
  makeService(): PlatformHostService;
}

/** Registry entry factory: PDD is the only canonical platform host. */
export function platformHostEntryFor(platform: PlatformId, makeService: () => PlatformHostService): PlatformHostEntry {
  return { platform, kind: "pdd", makeService };
}

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(value);
}
