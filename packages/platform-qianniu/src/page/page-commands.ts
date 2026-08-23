// M8 Qianniu page commands (clean-room, browser-safe). Finite allowlist dispatch.
export {
  dispatchCommand as dispatchQianniuCommand,
  isAllowedCommand as isQianniuCommandAllowed,
  COMMON_COMMAND_ALLOWLIST as QIANNIU_COMMAND_ALLOWLIST,
  FORBIDDEN_COMMAND_TYPES,
  type CommandHandlers as QianniuCommandHandlers,
} from "@fastwork/platform-web-common";
