// M8 Xianyu page IPC (clean-room). Dedicated xianyu-scoped channels + sender guard.
import { registerGenericPageIpc, type GenericPageIpcDeps } from "../shared/generic-page-ipc.js";

export const XIANYU_PAGE_EVENT_CHANNEL = "xianyu-page-event";
export const XIANYU_PAGE_COMMAND_CHANNEL = "xianyu-page-command";
export const XIANYU_PAGE_COMMAND_RESULT_CHANNEL = "xianyu-page-command-result";

export function registerXianyuPageIpc(deps: Omit<GenericPageIpcDeps, "eventChannel" | "commandChannel" | "commandResultChannel" | "eventSchemaId" | "resultSchemaId">): () => void {
  return registerGenericPageIpc({
    ...deps,
    eventChannel: XIANYU_PAGE_EVENT_CHANNEL,
    commandChannel: XIANYU_PAGE_COMMAND_CHANNEL,
    commandResultChannel: XIANYU_PAGE_COMMAND_RESULT_CHANNEL,
    eventSchemaId: "fastwork:platform:xianyu-page-event",
    resultSchemaId: "fastwork:platform:xianyu-page-command-result",
  });
}
