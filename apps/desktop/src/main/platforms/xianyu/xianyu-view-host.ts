// M8 Xianyu view host (clean-room). Main-owned WebContentsView via the shared host.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GenericViewHost, type ViewBounds } from "../shared/generic-view-host.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRELOAD = join(HERE, "..", "..", "..", "platform-preloads", "xianyu.js");

export function createXianyuViewHost(shopId: string, testMode: boolean, allowedProductionHosts?: readonly string[]): GenericViewHost {
  return new GenericViewHost({ platform: "xianyu", shopId, testMode, preloadPath: PRELOAD, allowedProductionHosts });
}

export { GenericViewHost as XianyuViewHost, type ViewBounds };
