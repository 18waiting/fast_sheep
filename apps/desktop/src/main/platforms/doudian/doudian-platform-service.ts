// M8 Doudian platform service (clean-room). Generic platform service bound to Doudian.
import type { ConversationOrchestrator } from "@fastwork/orchestrator";
import { DOUDIAN_CAPABILITIES } from "@fastwork/platform-doudian";
import { GenericPlatformService, type GenericPlatformServiceOptions } from "../shared/generic-platform-service.js";
import { createDoudianViewHost } from "./doudian-view-host.js";

export function createDoudianPlatformService(options: Omit<GenericPlatformServiceOptions, "platform" | "capabilities" | "preloadPath" | "commandChannel">): GenericPlatformService {
  return new GenericPlatformService({
    ...options,
    platform: "doudian",
    capabilities: DOUDIAN_CAPABILITIES,
    preloadPath: "", // unused: makeView is always provided
    commandChannel: "doudian-page-command",
    makeView: options.makeView ?? ((shopId: string, testMode: boolean) => createDoudianViewHost(shopId, testMode, options.allowedProductionHosts)),
  });
}

export { GenericPlatformService as DoudianPlatformService };
