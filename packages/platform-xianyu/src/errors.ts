// M8 Xianyu errors (clean-room). Reuses the platform-neutral error model.
export {
  PLATFORM_ERROR_CODES as XIANYU_ERROR_CODES,
  PlatformError as XianyuError,
  platformError as xianyuError,
  type PlatformErrorCode as XianyuErrorCode,
} from "@fastwork/platform-web-common";
