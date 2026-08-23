// M8 JD page commands (clean-room, browser-safe). Finite allowlist dispatch.
export {
  dispatchCommand as dispatchJDCommand,
  isAllowedCommand as isJDCommandAllowed,
  COMMON_COMMAND_ALLOWLIST as JD_COMMAND_ALLOWLIST,
  FORBIDDEN_COMMAND_TYPES,
  type CommandHandlers as JDCommandHandlers,
} from "@fastwork/platform-web-common";
