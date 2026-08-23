// M8 Qianniu errors (clean-room). Reuses the platform-neutral error model.
export {
  PLATFORM_ERROR_CODES as QIANNIU_ERROR_CODES,
  PlatformError as QianniuError,
  platformError as qianniuError,
  type PlatformErrorCode as QianniuErrorCode,
} from "@fastwork/platform-web-common";
