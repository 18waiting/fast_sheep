// M8 Kuaishou page commands (clean-room, browser-safe). Finite allowlist dispatch.
export {
  dispatchCommand as dispatchKuaishouCommand,
  isAllowedCommand as isKuaishouCommandAllowed,
  COMMON_COMMAND_ALLOWLIST as KUAISHOU_COMMAND_ALLOWLIST,
  FORBIDDEN_COMMAND_TYPES,
  type CommandHandlers as KuaishouCommandHandlers,
} from "@fastwork/platform-web-common";
