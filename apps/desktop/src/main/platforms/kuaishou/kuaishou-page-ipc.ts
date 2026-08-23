// M8 Kuaishou page IPC (clean-room). Dedicated kuaishou-scoped channels + sender guard.
import { registerGenericPageIpc, type GenericPageIpcDeps } from "../shared/generic-page-ipc.js";

export const KUAISHOU_PAGE_EVENT_CHANNEL = "kuaishou-page-event";
export const KUAISHOU_PAGE_COMMAND_CHANNEL = "kuaishou-page-command";
export const KUAISHOU_PAGE_COMMAND_RESULT_CHANNEL = "kuaishou-page-command-result";

export function registerKuaishouPageIpc(deps: Omit<GenericPageIpcDeps, "eventChannel" | "commandChannel" | "commandResultChannel" | "eventSchemaId" | "resultSchemaId">): () => void {
  return registerGenericPageIpc({
    ...deps,
    eventChannel: KUAISHOU_PAGE_EVENT_CHANNEL,
    commandChannel: KUAISHOU_PAGE_COMMAND_CHANNEL,
    commandResultChannel: KUAISHOU_PAGE_COMMAND_RESULT_CHANNEL,
    eventSchemaId: "fastwork:platform:kuaishou-page-event",
    resultSchemaId: "fastwork:platform:kuaishou-page-command-result",
  });
}
