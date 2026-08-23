// M8 Qianniu view host (clean-room). Main-owned WebContentsView via the shared host.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GenericViewHost, type ViewBounds } from "../shared/generic-view-host.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRELOAD = join(HERE, "..", "..", "..", "platform-preloads", "qianniu.js");

export function createQianniuViewHost(shopId: string, testMode: boolean, allowedProductionHosts?: readonly string[]): GenericViewHost {
  return new GenericViewHost({ platform: "qianniu", shopId, testMode, preloadPath: PRELOAD, allowedProductionHosts });
}

export { GenericViewHost as QianniuViewHost, type ViewBounds };
