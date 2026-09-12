// M7 PDD session state machine (clean-room). No Electron lifecycle here.
// READY is local/page-runtime readiness only; it is not PDD authentication truth.
import type { PddSessionStatusValue, SelectedCustomerObservationStatus } from "./types.js";

export type PddSelectedCustomerObservation =
  | { status: "SELECTED"; customerUid: string }
  | { status: Exclude<SelectedCustomerObservationStatus, "SELECTED"> };

export const SESSION_STATES: readonly PddSessionStatusValue[] = [
  "STOPPED", "CREATING", "LOADING", "LOGIN_REQUIRED", "READY", "DOM_UNSUPPORTED", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED",
] as const;

export const LEGAL_SESSION_TRANSITIONS: Readonly<Record<PddSessionStatusValue, readonly PddSessionStatusValue[]>> = {
  STOPPED: ["STOPPED", "CREATING", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED"],
  CREATING: ["CREATING", "LOADING", "LOGIN_REQUIRED", "READY", "DOM_UNSUPPORTED", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED"],
  LOADING: ["LOADING", "READY", "LOGIN_REQUIRED", "DOM_UNSUPPORTED", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED"],
  LOGIN_REQUIRED: ["LOGIN_REQUIRED", "READY", "DOM_UNSUPPORTED", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED"],
  READY: ["READY", "LOADING", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED"],
  DOM_UNSUPPORTED: ["DOM_UNSUPPORTED", "LOADING", "AUTH_REAUTH_REQUIRED", "ERROR", "DISPOSED"],
  AUTH_REAUTH_REQUIRED: ["AUTH_REAUTH_REQUIRED", "LOADING", "ERROR", "DISPOSED"],
  ERROR: ["ERROR", "LOADING", "AUTH_REAUTH_REQUIRED", "DISPOSED"],
  DISPOSED: ["DISPOSED"],
};

export class PddSessionTransitionError extends Error {
  constructor(
    readonly from: PddSessionStatusValue,
    readonly to: PddSessionStatusValue,
  ) {
    super(`illegal PDD session transition: ${from} -> ${to}`);
    this.name = "PddSessionTransitionError";
  }
}

export interface SessionStateView {
  shop_id: string;
  session_id: string;
  status: PddSessionStatusValue;
  last_error: string | null;
  active_conversation_id: string | null;
  buyer_id: string | null;
}

export class PddSessionState {
  private status: PddSessionStatusValue = "STOPPED";
  private lastError: string | null = null;
  private activeConversationId: string | null = null;
  private buyerId: string | null = null;
  private selectedCustomerObservation: PddSelectedCustomerObservation | null = null;

  constructor(
    readonly shopId: string,
    readonly sessionId: string,
  ) {}

  getStatus(): PddSessionStatusValue { return this.status; }
  getLastError(): string | null { return this.lastError; }
  getActiveConversationId(): string | null { return this.activeConversationId; }
  getBuyerId(): string | null { return this.buyerId; }
  getSelectedCustomerObservation(): PddSelectedCustomerObservation | null { return this.selectedCustomerObservation; }
  getSelectedCustomerUid(): string | null {
    return this.selectedCustomerObservation?.status === "SELECTED"
      ? this.selectedCustomerObservation.customerUid
      : null;
  }

  setSelectedCustomerObservation(observation: PddSelectedCustomerObservation): void {
    this.selectedCustomerObservation = observation;
  }

  clearSelectedCustomerObservation(): void {
    this.selectedCustomerObservation = null;
  }

  setStatus(next: PddSessionStatusValue, error: string | null = null): void {
    if (!SESSION_STATES.includes(next)) throw new Error("invalid session status: " + next);
    if (!LEGAL_SESSION_TRANSITIONS[this.status].includes(next)) {
      throw new PddSessionTransitionError(this.status, next);
    }
    this.status = next;
    if (["LOGIN_REQUIRED", "DOM_UNSUPPORTED", "AUTH_REAUTH_REQUIRED", "DISPOSED"].includes(next)) {
      this.clearSelectedCustomerObservation();
    }
    if (next === "AUTH_REAUTH_REQUIRED") this.lastError = null;
    else if (error !== null) this.lastError = error.slice(0, 200);
  }

  setConversation(conversationId: string, buyerId?: string): void {
    this.activeConversationId = conversationId;
    this.buyerId = buyerId ?? null;
  }

  isReady(): boolean {
    return this.status === "READY";
  }

  isAuthReauthRequired(): boolean {
    return this.status === "AUTH_REAUTH_REQUIRED";
  }

  view(): SessionStateView {
    return {
      shop_id: this.shopId,
      session_id: this.sessionId,
      status: this.status,
      last_error: this.lastError,
      active_conversation_id: this.activeConversationId,
      buyer_id: this.buyerId,
    };
  }
}
