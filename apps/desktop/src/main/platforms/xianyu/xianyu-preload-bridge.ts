// M8 Xianyu preload bridge (clean-room). Shared bridge with xianyu command channel.
import { GenericPreloadBridge } from "../shared/generic-session.js";
import type { GenericViewHost } from "../shared/generic-view-host.js";
import { XIANYU_PAGE_COMMAND_CHANNEL } from "./xianyu-page-ipc.js";

export class XianyuPreloadBridge extends GenericPreloadBridge {
  constructor(view: GenericViewHost, timeoutMs?: number) {
    super(view, XIANYU_PAGE_COMMAND_CHANNEL, timeoutMs);
  }
}
