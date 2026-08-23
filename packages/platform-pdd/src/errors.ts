// M7 PDD platform errors (clean-room, normalized). No raw DOM/fs/Electron/Python internals.
export const PDD_ERROR_CODES = {
  DOM_UNAVAILABLE: "platform.dom_unavailable",
  NOT_READY: "platform.not_ready",
  SEND_UNCERTAIN: "platform.send_uncertain",
  TRANSFER_TARGET_UNAVAILABLE: "platform.transfer_target_unavailable",
  NOT_FOUND: "platform.not_found",
  INVALID_COMMAND: "platform.invalid_command",
  SESSION_ERROR: "platform.session_error",
  UNSUPPORTED_CAPABILITY: "capability.unsupported",
} as const;

export type PddErrorCode = (typeof PDD_ERROR_CODES)[keyof typeof PDD_ERROR_CODES];

export class PddError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PddError";
    this.code = code;
  }
}

export function pddError(code: string, message: string): PddError {
  return new PddError(code, message);
}
