// M8 Doudian preload bridge (clean-room). Shared bridge with doudian command channel.
import { GenericPreloadBridge } from "../shared/generic-session.js";
import type { GenericViewHost } from "../shared/generic-view-host.js";
import { DOUDIAN_PAGE_COMMAND_CHANNEL } from "./doudian-page-ipc.js";

export class DoudianPreloadBridge extends GenericPreloadBridge {
  constructor(view: GenericViewHost, timeoutMs?: number) {
    super(view, DOUDIAN_PAGE_COMMAND_CHANNEL, timeoutMs);
  }
}
