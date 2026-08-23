// M8 JD platform adapter (clean-room). Built from the platform-neutral factory
// with JD capabilities + synthetic DOM bridge. One segment per sendText call;
// no segmentation/sleep; no target selection; capability-gated image/transfer.
import { createPlatformAdapter, type GenericPlatformAdapter, type PlatformAdapterOptions } from "@fastwork/platform-web-common";
import { JD_CAPABILITIES } from "./capabilities.js";

export function createJDPlatformAdapter(options: Omit<PlatformAdapterOptions, "platform" | "capabilities">): GenericPlatformAdapter {
  return createPlatformAdapter({ ...options, platform: "jd", capabilities: JD_CAPABILITIES });
}

export type JDPlatformAdapter = GenericPlatformAdapter;
