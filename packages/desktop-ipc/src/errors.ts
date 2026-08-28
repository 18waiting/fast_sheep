// Normalized desktop IPC errors (M6). No raw DB/fs/Electron/Python payloads in public errors.
export const DESKTOP_ERROR_CODES = {
  INVALID_REQUEST: "desktop.invalid_request",
  FORBIDDEN_SENDER: "desktop.forbidden_sender",
  NOT_READY: "desktop.not_ready",
  NOT_FOUND: "desktop.not_found",
  COMMAND_FAILED: "desktop.command_failed",
  WORKER_UNAVAILABLE: "desktop.worker_unavailable",
  // SHEEP-063-PR2 (I-25): no trusted workspace merchant authorization context.
  // Must NEVER be represented as empty domain data (DP-48).
  WORKSPACE_UNAVAILABLE: "desktop.workspace_unavailable",
} as const;

export type DesktopErrorCode = (typeof DESKTOP_ERROR_CODES)[keyof typeof DESKTOP_ERROR_CODES];

export interface DesktopErrorShape {
  code: string;
  category: string;
  message: string;
  retryable: boolean;
}

export class DesktopError extends Error {
  readonly code: string;
  readonly category: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, category = "internal", retryable = false) {
    super(message);
    this.name = "DesktopError";
    this.code = code;
    this.category = category;
    this.retryable = retryable;
  }

  toShape(): DesktopErrorShape {
    return { code: this.code, category: this.category, message: this.message, retryable: this.retryable };
  }
}

export function desktopError(code: string, message: string): DesktopError {
  return new DesktopError(code, message, code.startsWith("desktop.invalid") ? "validation" : "internal");
}

