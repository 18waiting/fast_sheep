// M8 Xianyu platform service (clean-room). Generic platform service bound to Xianyu.
import type { ConversationOrchestrator } from "@fastwork/orchestrator";
import { XIANYU_CAPABILITIES } from "@fastwork/platform-xianyu";
import { GenericPlatformService, type GenericPlatformServiceOptions } from "../shared/generic-platform-service.js";
import { createXianyuViewHost } from "./xianyu-view-host.js";

export function createXianyuPlatformService(options: Omit<GenericPlatformServiceOptions, "platform" | "capabilities" | "preloadPath" | "commandChannel">): GenericPlatformService {
  return new GenericPlatformService({
    ...options,
    platform: "xianyu",
    capabilities: XIANYU_CAPABILITIES,
    preloadPath: "", // unused: makeView is always provided
    commandChannel: "xianyu-page-command",
    makeView: options.makeView ?? ((shopId: string, testMode: boolean) => createXianyuViewHost(shopId, testMode, options.allowedProductionHosts)),
  });
}

export { GenericPlatformService as XianyuPlatformService };
