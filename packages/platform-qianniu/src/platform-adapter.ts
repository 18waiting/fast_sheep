// M8 Qianniu platform adapter (clean-room). Built from the platform-neutral factory
// with Qianniu capabilities + synthetic DOM bridge. One segment per sendText call;
// no segmentation/sleep; no target selection; capability-gated image/transfer.
import { createPlatformAdapter, type GenericPlatformAdapter, type PlatformAdapterOptions } from "@fastwork/platform-web-common";
import { QIANNIU_CAPABILITIES } from "./capabilities.js";

export function createQianniuPlatformAdapter(options: Omit<PlatformAdapterOptions, "platform" | "capabilities">): GenericPlatformAdapter {
  return createPlatformAdapter({ ...options, platform: "qianniu", capabilities: QIANNIU_CAPABILITIES });
}

export type QianniuPlatformAdapter = GenericPlatformAdapter;
