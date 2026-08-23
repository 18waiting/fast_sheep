// M8 Qianniu preload bridge (clean-room). Shared bridge with qianniu command channel.
import { GenericPreloadBridge } from "../shared/generic-session.js";
import type { GenericViewHost } from "../shared/generic-view-host.js";
import { QIANNIU_PAGE_COMMAND_CHANNEL } from "./qianniu-page-ipc.js";

export class QianniuPreloadBridge extends GenericPreloadBridge {
  constructor(view: GenericViewHost, timeoutMs?: number) {
    super(view, QIANNIU_PAGE_COMMAND_CHANNEL, timeoutMs);
  }
}
