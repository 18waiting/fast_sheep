// M8 Doudian page commands (clean-room, browser-safe). Finite allowlist dispatch.
export {
  dispatchCommand as dispatchDoudianCommand,
  isAllowedCommand as isDoudianCommandAllowed,
  COMMON_COMMAND_ALLOWLIST as DOUDIAN_COMMAND_ALLOWLIST,
  FORBIDDEN_COMMAND_TYPES,
  type CommandHandlers as DoudianCommandHandlers,
} from "@fastwork/platform-web-common";
