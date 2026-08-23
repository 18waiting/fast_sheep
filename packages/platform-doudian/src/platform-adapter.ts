// M8 Doudian platform adapter (clean-room). Built from the platform-neutral factory
// with Doudian capabilities + synthetic DOM bridge. One segment per sendText call;
// no segmentation/sleep; no target selection; capability-gated image/transfer.
import { createPlatformAdapter, type GenericPlatformAdapter, type PlatformAdapterOptions } from "@fastwork/platform-web-common";
import { DOUDIAN_CAPABILITIES } from "./capabilities.js";

export function createDoudianPlatformAdapter(options: Omit<PlatformAdapterOptions, "platform" | "capabilities">): GenericPlatformAdapter {
  return createPlatformAdapter({ ...options, platform: "doudian", capabilities: DOUDIAN_CAPABILITIES });
}

export type DoudianPlatformAdapter = GenericPlatformAdapter;
