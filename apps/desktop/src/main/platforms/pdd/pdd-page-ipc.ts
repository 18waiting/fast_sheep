// M7 dedicated PDD page IPC (clean-room). Registers the platform-preload channels
// with a dedicated trusted-webContents sender guard. No business orchestration here.
import { createRequire } from "node:module";
import type { IpcMainEvent, WebContents } from "electron";
import { validatorFor } from "@fastwork/contracts";

type IpcMainListener = (event: IpcMainEvent, ...args: unknown[]) => void;
interface IpcMainLike {
  on(channel: string, listener: IpcMainListener): void;
  removeListener(channel: string, listener: IpcMainListener): void;
}

const nodeRequire = createRequire(import.meta.url);
let _ipcMain: IpcMainLike | null = null;
function ipcMain(): IpcMainLike {
  if (!_ipcMain) _ipcMain = (nodeRequire("electron") as { ipcMain: IpcMainLike }).ipcMain;
  return _ipcMain;
}

export const PDD_PAGE_EVENT_CHANNEL = "pdd-page-event";
export const PDD_PAGE_COMMAND_CHANNEL = "pdd-page-command";
export const PDD_PAGE_COMMAND_RESULT_CHANNEL = "pdd-page-command-result";

export interface PddPageIpcDeps {
  isTrustedPddWebContents(wc: WebContents): boolean;
  onPageEvent(payload: unknown, sender: WebContents): void;
  onCommandResult(payload: unknown, sender: WebContents): void;
  /** Test seam: inject a fake ipcMain; defaults to the lazy Electron ipcMain. */
  ipc?: IpcMainLike;
  /** Test seam: override validator availability; undefined uses the schema validator. */
  eventValidatorOverride?: ((value: unknown) => boolean) | null;
  resultValidatorOverride?: ((value: unknown) => boolean) | null;
}

const eventValidator = (() => {
  try {
    return validatorFor("fastwork:platform:pdd-page-event");
  } catch {
    return null;
  }
})();

const resultValidator = (() => {
  try {
    return validatorFor("fastwork:platform:pdd-page-command-result");
  } catch {
    return null;
  }
})();

export function registerPddPageIpc(deps: PddPageIpcDeps): () => void {
  const ipc: IpcMainLike = deps.ipc ?? ipcMain();
  const eventValidation = deps.eventValidatorOverride === undefined ? eventValidator : deps.eventValidatorOverride;
  const resultValidation = deps.resultValidatorOverride === undefined ? resultValidator : deps.resultValidatorOverride;
  const onPageEvent: IpcMainListener = (event: IpcMainEvent, payload: unknown): void => {
    if (!deps.isTrustedPddWebContents(event.sender)) return;
    if (!eventValidation || !eventValidation(payload)) return;
    deps.onPageEvent(payload, event.sender);
  };
  const onCommandResult: IpcMainListener = (event: IpcMainEvent, payload: unknown): void => {
    if (!deps.isTrustedPddWebContents(event.sender)) return;
    if (!resultValidation || !resultValidation(payload)) return;
    deps.onCommandResult(payload, event.sender);
  };
  ipc.on(PDD_PAGE_EVENT_CHANNEL, onPageEvent);
  ipc.on(PDD_PAGE_COMMAND_RESULT_CHANNEL, onCommandResult);
  return () => {
    ipc.removeListener(PDD_PAGE_EVENT_CHANNEL, onPageEvent);
    ipc.removeListener(PDD_PAGE_COMMAND_RESULT_CHANNEL, onCommandResult);
  };
}
