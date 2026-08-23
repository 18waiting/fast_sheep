// M8 platform host registry (clean-room). Maps the six canonical platform ids to
// host/service factories. No scattered switch statements.
import type { PddPlatformService } from "./pdd/pdd-platform-service.js";
import type { GenericPlatformService } from "./shared/generic-platform-service.js";

export const PLATFORM_IDS = ["pdd", "doudian", "jd", "kuaishou", "qianniu", "xianyu"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export type PlatformHostService = PddPlatformService | GenericPlatformService;

export interface PlatformHostEntry {
  platform: PlatformId;
  kind: "pdd" | "generic";
  makeService(): PlatformHostService;
}

/** M8 registry: PDD uses the M7 PddPlatformService; the other five use the
 * generic platform service bound to their platform package capabilities. */
export function platformHostEntryFor(platform: PlatformId, makeService: () => PlatformHostService): PlatformHostEntry {
  return { platform, kind: platform === "pdd" ? "pdd" : "generic", makeService };
}

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(value);
}
