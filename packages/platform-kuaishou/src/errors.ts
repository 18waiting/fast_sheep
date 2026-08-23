// M8 Kuaishou errors (clean-room). Reuses the platform-neutral error model.
export {
  PLATFORM_ERROR_CODES as KUAISHOU_ERROR_CODES,
  PlatformError as KuaishouError,
  platformError as kuaishouError,
  type PlatformErrorCode as KuaishouErrorCode,
} from "@fastwork/platform-web-common";
