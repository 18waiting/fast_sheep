// M8 Qianniu platform service (clean-room). Generic platform service bound to Qianniu.
import type { ConversationOrchestrator } from "@fastwork/orchestrator";
import { QIANNIU_CAPABILITIES } from "@fastwork/platform-qianniu";
import { GenericPlatformService, type GenericPlatformServiceOptions } from "../shared/generic-platform-service.js";
import { createQianniuViewHost } from "./qianniu-view-host.js";

export function createQianniuPlatformService(options: Omit<GenericPlatformServiceOptions, "platform" | "capabilities" | "preloadPath" | "commandChannel">): GenericPlatformService {
  return new GenericPlatformService({
    ...options,
    platform: "qianniu",
    capabilities: QIANNIU_CAPABILITIES,
    preloadPath: "", // unused: makeView is always provided
    commandChannel: "qianniu-page-command",
    makeView: options.makeView ?? ((shopId: string, testMode: boolean) => createQianniuViewHost(shopId, testMode, options.allowedProductionHosts)),
  });
}

export { GenericPlatformService as QianniuPlatformService };
