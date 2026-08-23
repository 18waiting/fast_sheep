// M8 platform-web-common errors (clean-room, platform-neutral).
export const PLATFORM_ERROR_CODES = {
  DOM_UNAVAILABLE: "platform.dom_unavailable",
  NOT_READY: "platform.not_ready",
  SEND_UNCERTAIN: "platform.send_uncertain",
  TRANSFER_TARGET_UNAVAILABLE: "platform.transfer_target_unavailable",
  NOT_FOUND: "platform.not_found",
  INVALID_COMMAND: "platform.invalid_command",
  SESSION_ERROR: "platform.session_error",
  UNSUPPORTED_CAPABILITY: "capability.unsupported",
} as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];

export class PlatformError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PlatformError";
    this.code = code;
  }
}

export function platformError(code: string, message: string): PlatformError {
  return new PlatformError(code, message);
}
