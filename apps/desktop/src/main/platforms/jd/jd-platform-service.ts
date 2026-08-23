// M8 JD platform service (clean-room). Generic platform service bound to JD.
import type { ConversationOrchestrator } from "@fastwork/orchestrator";
import { JD_CAPABILITIES } from "@fastwork/platform-jd";
import { GenericPlatformService, type GenericPlatformServiceOptions } from "../shared/generic-platform-service.js";
import { createJDViewHost } from "./jd-view-host.js";

export function createJDPlatformService(options: Omit<GenericPlatformServiceOptions, "platform" | "capabilities" | "preloadPath" | "commandChannel">): GenericPlatformService {
  return new GenericPlatformService({
    ...options,
    platform: "jd",
    capabilities: JD_CAPABILITIES,
    preloadPath: "", // unused: makeView is always provided
    commandChannel: "jd-page-command",
    makeView: options.makeView ?? ((shopId: string, testMode: boolean) => createJDViewHost(shopId, testMode, options.allowedProductionHosts)),
  });
}

export { GenericPlatformService as JDPlatformService };
