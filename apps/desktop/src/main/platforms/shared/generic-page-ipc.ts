// M8 generic platform page IPC (clean-room). Dedicated platform-scoped channels
// with a trusted-webContents sender guard + schema validation.
import { createRequire } from "node:module";
import type { IpcMainEvent, WebContents } from "electron";
import { validatorFor } from "@fastwork/contracts";

type Listener = (event: IpcMainEvent, ...args: unknown[]) => void;
interface IpcMainLike {
  on(channel: string, listener: Listener): void;
  removeListener(channel: string, listener: Listener): void;
}

const nodeRequire = createRequire(import.meta.url);
let _ipcMain: IpcMainLike | null = null;
function ipcMain(): IpcMainLike {
  if (!_ipcMain) _ipcMain = (nodeRequire("electron") as { ipcMain: IpcMainLike }).ipcMain;
  return _ipcMain;
}

export interface GenericPageIpcDeps {
  eventChannel: string;
  commandChannel: string;
  commandResultChannel: string;
  eventSchemaId: string;
  resultSchemaId: string;
  isTrustedWebContents(wc: WebContents): boolean;
  onPageEvent(payload: unknown, sender: WebContents): void;
  onCommandResult(payload: unknown, sender: WebContents): void;
  ipc?: IpcMainLike;
}

export function registerGenericPageIpc(deps: GenericPageIpcDeps): () => void {
  const ipc = deps.ipc ?? ipcMain();
  const eventValidator = (() => { try { return validatorFor(deps.eventSchemaId); } catch { return null; } })();
  const resultValidator = (() => { try { return validatorFor(deps.resultSchemaId); } catch { return null; } })();
  const onPageEvent: Listener = (event: IpcMainEvent, payload: unknown): void => {
    if (!deps.isTrustedWebContents(event.sender)) return;
    if (eventValidator && !eventValidator(payload)) return;
    deps.onPageEvent(payload, event.sender);
  };
  const onCommandResult: Listener = (event: IpcMainEvent, payload: unknown): void => {
    if (!deps.isTrustedWebContents(event.sender)) return;
    if (resultValidator && !resultValidator(payload)) return;
    deps.onCommandResult(payload, event.sender);
  };
  ipc.on(deps.eventChannel, onPageEvent);
  ipc.on(deps.commandResultChannel, onCommandResult);
  return () => {
    ipc.removeListener(deps.eventChannel, onPageEvent);
    ipc.removeListener(deps.commandResultChannel, onCommandResult);
  };
}
