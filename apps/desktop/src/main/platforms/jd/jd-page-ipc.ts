// M8 JD page IPC (clean-room). Dedicated jd-scoped channels + sender guard.
import { registerGenericPageIpc, type GenericPageIpcDeps } from "../shared/generic-page-ipc.js";

export const JD_PAGE_EVENT_CHANNEL = "jd-page-event";
export const JD_PAGE_COMMAND_CHANNEL = "jd-page-command";
export const JD_PAGE_COMMAND_RESULT_CHANNEL = "jd-page-command-result";

export function registerJDPageIpc(deps: Omit<GenericPageIpcDeps, "eventChannel" | "commandChannel" | "commandResultChannel" | "eventSchemaId" | "resultSchemaId">): () => void {
  return registerGenericPageIpc({
    ...deps,
    eventChannel: JD_PAGE_EVENT_CHANNEL,
    commandChannel: JD_PAGE_COMMAND_CHANNEL,
    commandResultChannel: JD_PAGE_COMMAND_RESULT_CHANNEL,
    eventSchemaId: "fastwork:platform:jd-page-event",
    resultSchemaId: "fastwork:platform:jd-page-command-result",
  });
}
