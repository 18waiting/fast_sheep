// M8 platform-web-common DOM command model (platform-neutral).
import type { PlatformPageCommand, PlatformPageCommandResult } from "./types.js";
import { PLATFORM_ERROR_CODES } from "./errors.js";

export const COMMON_COMMAND_ALLOWLIST = [
  "scan", "send_text", "send_image", "transfer", "focus_conversation", "health",
] as const;

export function isAllowedCommand(type: string): boolean {
  return (COMMON_COMMAND_ALLOWLIST as readonly string[]).includes(type);
}

/** Forbidden generic remote-control command types. */
export const FORBIDDEN_COMMAND_TYPES = [
  "execute_js", "click_selector", "query_selector", "set_html", "run_script",
] as const;

export interface CommandHandlers {
  health(command: PlatformPageCommand): PlatformPageCommandResult;
  scan(command: PlatformPageCommand): PlatformPageCommandResult;
  send_text(command: PlatformPageCommand): PlatformPageCommandResult;
  send_image(command: PlatformPageCommand): PlatformPageCommandResult;
  transfer(command: PlatformPageCommand): PlatformPageCommandResult;
  focus_conversation(command: PlatformPageCommand): PlatformPageCommandResult;
}

/** Finite-allowlist command dispatch. Unsupported types are rejected. */
export function dispatchCommand(command: PlatformPageCommand, handlers: CommandHandlers): PlatformPageCommandResult {
  if (!isAllowedCommand(command.type)) {
    return { command_id: command.command_id, ok: false, error: PLATFORM_ERROR_CODES.INVALID_COMMAND };
  }
  const handler = handlers[command.type as keyof CommandHandlers];
  if (!handler) {
    return { command_id: command.command_id, ok: false, error: PLATFORM_ERROR_CODES.INVALID_COMMAND };
  }
  return handler(command);
}
