// M6 IPC guard: allowlisted channel + sender identity + schema validation.
import {
  isAllowedChannel,
  DesktopError,
  DESKTOP_ERROR_CODES,
  validateSetModeRequest,
  validateManualSendRequest,
  validateNoSaveSendRequest,
  validateCancelRequest,
  validateFocusRequest,
  validateBootstrapState,
  validateWorkbenchViewModel,
  validateWorkerStatus,
  type DesktopResult,
} from "@fastwork/desktop-ipc";
import { IPC } from "@fastwork/desktop-ipc";

export interface SenderIdentity {
  isTrustedWindow: boolean;
}

export interface GuardDeps {
  sender(): SenderIdentity;
}

export type Handler<TReq, TRes> = (req: TReq) => Promise<DesktopResult<TRes>> | DesktopResult<TRes>;

export function ok<T>(data: T): DesktopResult<T> {
  return { ok: true, data };
}

export function err<T = never>(error: DesktopError): DesktopResult<T> {
  return { ok: false, error: error.toShape() };
}

export class IpcGuard {
  constructor(private readonly deps: GuardDeps) {}

  validateRequest(channel: string, payload: unknown): DesktopError | null {
    if (!isAllowedChannel(channel)) {
      return new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown channel");
    }
    if (!this.deps.sender().isTrustedWindow) {
      return new DesktopError(DESKTOP_ERROR_CODES.FORBIDDEN_SENDER, "untrusted sender");
    }
    switch (channel) {
      case IPC.setMode:
        return validateSetModeRequest(payload).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, "invalid set_mode request");
      case IPC.manualSend:
        return validateManualSendRequest(payload).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, "invalid manual_send request");
      case IPC.noSaveSend:
        return validateNoSaveSendRequest(payload).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, "invalid no_save_send request");
      case IPC.cancel:
        return validateCancelRequest(payload).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, "invalid cancel request");
      case IPC.focus:
        return validateFocusRequest(payload).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, "invalid focus request");
      default:
        return null; // queries accept undefined/loose payloads
    }
  }

  /** Validate Main-produced responses where a schema exists (response validation). */
  validateResponse(channel: string, data: unknown): DesktopError | null {
    switch (channel) {
      case IPC.bootstrap:
        return validateBootstrapState(data).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.COMMAND_FAILED, "invalid bootstrap response");
      case IPC.snapshot:
        return validateWorkbenchViewModel(data).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.COMMAND_FAILED, "invalid snapshot response");
      case IPC.workerStatus:
        return validateWorkerStatus(data).ok ? null : new DesktopError(DESKTOP_ERROR_CODES.COMMAND_FAILED, "invalid worker status response");
      default:
        return null;
    }
  }

  /** Wrap a handler so malformed input never reaches the orchestrator. */
  guard<TReq, TRes>(channel: string, handler: Handler<TReq, TRes>): (payload: unknown) => Promise<DesktopResult<TRes>> {
    return async (payload: unknown) => {
      const validationError = this.validateRequest(channel, payload);
      if (validationError) return err<TRes>(validationError);
      try {
        const result = await handler(payload as TReq);
        if (!result.ok) return result;
        // Response validation checks the payload data against its schema.
        const responseError = this.validateResponse(channel, result.data);
        if (responseError) return err<TRes>(responseError);
        return result;
      } catch (e) {
        if (e instanceof DesktopError) return err<TRes>(e);
        return err<TRes>(new DesktopError(DESKTOP_ERROR_CODES.COMMAND_FAILED, "command failed"));
      }
    };
  }
}
