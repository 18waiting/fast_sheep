// M8 Kuaishou platform service (clean-room). Generic platform service bound to Kuaishou.
import type { ConversationOrchestrator } from "@fastwork/orchestrator";
import { KUAISHOU_CAPABILITIES } from "@fastwork/platform-kuaishou";
import { GenericPlatformService, type GenericPlatformServiceOptions } from "../shared/generic-platform-service.js";
import { createKuaishouViewHost } from "./kuaishou-view-host.js";

export function createKuaishouPlatformService(options: Omit<GenericPlatformServiceOptions, "platform" | "capabilities" | "preloadPath" | "commandChannel">): GenericPlatformService {
  return new GenericPlatformService({
    ...options,
    platform: "kuaishou",
    capabilities: KUAISHOU_CAPABILITIES,
    preloadPath: "", // unused: makeView is always provided
    commandChannel: "kuaishou-page-command",
    makeView: options.makeView ?? ((shopId: string, testMode: boolean) => createKuaishouViewHost(shopId, testMode, options.allowedProductionHosts)),
  });
}

export { GenericPlatformService as KuaishouPlatformService };
