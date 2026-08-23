// M6 central IPC registration. All channels registered here; no ad-hoc ipcMain.handle elsewhere.
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { IPC, isAllowedChannel } from "@fastwork/desktop-ipc";
import { IpcGuard, type Handler } from "./ipc-guard.js";
import { QUERY_HANDLERS, type QueryDeps } from "./query-handlers.js";
import { COMMAND_HANDLERS, type CommandDeps } from "./command-handlers.js";
import type { PlatformSessionCoordinator } from "../platforms/platform-session-coordinator.js";

export interface RegisterIpcOptions extends QueryDeps, CommandDeps {
  trustedWebContents: () => WebContents | null;
  revision(): number;
  coordinator: PlatformSessionCoordinator;
  platformForShop(shopId: string): string | null;
  contentBounds?: () => { x: number; y: number; width: number; height: number; visible: boolean };
}

export interface RegisteredChannel { channel: string; direction: "query" | "command"; handlerOwner: string }

export function registerIpc(options: RegisterIpcOptions): RegisteredChannel[] {
  const guard = new IpcGuard({ sender: () => ({ isTrustedWindow: options.trustedWebContents() !== null }) });
  const registered: RegisteredChannel[] = [];

  const queryEntries = (Object.keys(QUERY_HANDLERS) as Array<keyof typeof QUERY_HANDLERS>).map((k) => ({
    channel: k as string, make: QUERY_HANDLERS[k](options) as Handler<unknown, unknown>, direction: "query" as const,
  }));
  const commandEntries = (Object.keys(COMMAND_HANDLERS) as Array<keyof typeof COMMAND_HANDLERS>).map((k) => ({
    channel: k as string, make: COMMAND_HANDLERS[k](options) as Handler<unknown, unknown>, direction: "command" as const,
  }));

  for (const { channel, make, direction } of [...queryEntries, ...commandEntries]) {
    if (!isAllowedChannel(channel)) throw new Error("non-allowlisted channel: " + channel);
    ipcMain.handle(channel, (_event: IpcMainInvokeEvent, payload: unknown) => guard.guard(channel, make)(payload));
    registered.push({ channel, direction, handlerOwner: direction === "query" ? "query-handlers" : "command-handlers" });
  }
  return registered;
}

export function broadcast(sink: WebContents | null, channel: string, payload: unknown): void {
  if (sink && !sink.isDestroyed()) sink.send(channel, payload);
}
