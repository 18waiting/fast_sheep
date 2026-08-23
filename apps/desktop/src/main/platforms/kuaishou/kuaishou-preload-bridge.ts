// M8 Kuaishou preload bridge (clean-room). Shared bridge with kuaishou command channel.
import { GenericPreloadBridge } from "../shared/generic-session.js";
import type { GenericViewHost } from "../shared/generic-view-host.js";
import { KUAISHOU_PAGE_COMMAND_CHANNEL } from "./kuaishou-page-ipc.js";

export class KuaishouPreloadBridge extends GenericPreloadBridge {
  constructor(view: GenericViewHost, timeoutMs?: number) {
    super(view, KUAISHOU_PAGE_COMMAND_CHANNEL, timeoutMs);
  }
}
