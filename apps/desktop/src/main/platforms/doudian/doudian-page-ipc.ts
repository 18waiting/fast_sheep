// M8 Doudian page IPC (clean-room). Dedicated doudian-scoped channels + sender guard.
import { registerGenericPageIpc, type GenericPageIpcDeps } from "../shared/generic-page-ipc.js";

export const DOUDIAN_PAGE_EVENT_CHANNEL = "doudian-page-event";
export const DOUDIAN_PAGE_COMMAND_CHANNEL = "doudian-page-command";
export const DOUDIAN_PAGE_COMMAND_RESULT_CHANNEL = "doudian-page-command-result";

export function registerDoudianPageIpc(deps: Omit<GenericPageIpcDeps, "eventChannel" | "commandChannel" | "commandResultChannel" | "eventSchemaId" | "resultSchemaId">): () => void {
  return registerGenericPageIpc({
    ...deps,
    eventChannel: DOUDIAN_PAGE_EVENT_CHANNEL,
    commandChannel: DOUDIAN_PAGE_COMMAND_CHANNEL,
    commandResultChannel: DOUDIAN_PAGE_COMMAND_RESULT_CHANNEL,
    eventSchemaId: "fastwork:platform:doudian-page-event",
    resultSchemaId: "fastwork:platform:doudian-page-command-result",
  });
}
