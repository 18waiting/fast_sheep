// M8 Qianniu page IPC (clean-room). Dedicated qianniu-scoped channels + sender guard.
import { registerGenericPageIpc, type GenericPageIpcDeps } from "../shared/generic-page-ipc.js";

export const QIANNIU_PAGE_EVENT_CHANNEL = "qianniu-page-event";
export const QIANNIU_PAGE_COMMAND_CHANNEL = "qianniu-page-command";
export const QIANNIU_PAGE_COMMAND_RESULT_CHANNEL = "qianniu-page-command-result";

export function registerQianniuPageIpc(deps: Omit<GenericPageIpcDeps, "eventChannel" | "commandChannel" | "commandResultChannel" | "eventSchemaId" | "resultSchemaId">): () => void {
  return registerGenericPageIpc({
    ...deps,
    eventChannel: QIANNIU_PAGE_EVENT_CHANNEL,
    commandChannel: QIANNIU_PAGE_COMMAND_CHANNEL,
    commandResultChannel: QIANNIU_PAGE_COMMAND_RESULT_CHANNEL,
    eventSchemaId: "fastwork:platform:qianniu-page-event",
    resultSchemaId: "fastwork:platform:qianniu-page-command-result",
  });
}
