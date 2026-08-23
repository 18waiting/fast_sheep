// M8 JD errors (clean-room). Reuses the platform-neutral error model.
export {
  PLATFORM_ERROR_CODES as JD_ERROR_CODES,
  PlatformError as JDError,
  platformError as jdError,
  type PlatformErrorCode as JDErrorCode,
} from "@fastwork/platform-web-common";
