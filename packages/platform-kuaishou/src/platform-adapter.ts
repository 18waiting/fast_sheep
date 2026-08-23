// M8 Kuaishou platform adapter (clean-room). Built from the platform-neutral factory
// with Kuaishou capabilities + synthetic DOM bridge. One segment per sendText call;
// no segmentation/sleep; no target selection; capability-gated image/transfer.
import { createPlatformAdapter, type GenericPlatformAdapter, type PlatformAdapterOptions } from "@fastwork/platform-web-common";
import { KUAISHOU_CAPABILITIES } from "./capabilities.js";

export function createKuaishouPlatformAdapter(options: Omit<PlatformAdapterOptions, "platform" | "capabilities">): GenericPlatformAdapter {
  return createPlatformAdapter({ ...options, platform: "kuaishou", capabilities: KUAISHOU_CAPABILITIES });
}

export type KuaishouPlatformAdapter = GenericPlatformAdapter;
