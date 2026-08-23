// M8 Doudian errors (clean-room). Reuses the platform-neutral error model.
export {
  PLATFORM_ERROR_CODES as DOUDIAN_ERROR_CODES,
  PlatformError as DoudianError,
  platformError as doudianError,
  type PlatformErrorCode as DoudianErrorCode,
} from "@fastwork/platform-web-common";
