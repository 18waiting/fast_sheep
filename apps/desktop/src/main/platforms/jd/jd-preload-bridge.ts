// M8 JD preload bridge (clean-room). Shared bridge with jd command channel.
import { GenericPreloadBridge } from "../shared/generic-session.js";
import type { GenericViewHost } from "../shared/generic-view-host.js";
import { JD_PAGE_COMMAND_CHANNEL } from "./jd-page-ipc.js";

export class JDPreloadBridge extends GenericPreloadBridge {
  constructor(view: GenericViewHost, timeoutMs?: number) {
    super(view, JD_PAGE_COMMAND_CHANNEL, timeoutMs);
  }
}
