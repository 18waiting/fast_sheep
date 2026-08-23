// M8 Xianyu platform adapter (clean-room). Built from the platform-neutral factory
// with Xianyu capabilities + synthetic DOM bridge. One segment per sendText call;
// no segmentation/sleep; no target selection; capability-gated image/transfer.
import { createPlatformAdapter, type GenericPlatformAdapter, type PlatformAdapterOptions } from "@fastwork/platform-web-common";
import { XIANYU_CAPABILITIES } from "./capabilities.js";

export function createXianyuPlatformAdapter(options: Omit<PlatformAdapterOptions, "platform" | "capabilities">): GenericPlatformAdapter {
  return createPlatformAdapter({ ...options, platform: "xianyu", capabilities: XIANYU_CAPABILITIES });
}

export type XianyuPlatformAdapter = GenericPlatformAdapter;
