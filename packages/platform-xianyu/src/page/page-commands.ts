// M8 Xianyu page commands (clean-room, browser-safe). Finite allowlist dispatch.
export {
  dispatchCommand as dispatchXianyuCommand,
  isAllowedCommand as isXianyuCommandAllowed,
  COMMON_COMMAND_ALLOWLIST as XIANYU_COMMAND_ALLOWLIST,
  FORBIDDEN_COMMAND_TYPES,
  type CommandHandlers as XianyuCommandHandlers,
} from "@fastwork/platform-web-common";
