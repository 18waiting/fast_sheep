// M7 PDD session state machine (clean-room). No Electron lifecycle here.
import type { PddSessionStatusValue } from "./types.js";

export const SESSION_STATES: readonly PddSessionStatusValue[] = [
  "STOPPED", "CREATING", "LOADING", "LOGIN_REQUIRED", "READY", "DOM_UNSUPPORTED", "ERROR", "DISPOSED",
] as const;

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

  constructor(
    readonly shopId: string,
    readonly sessionId: string,
  ) {}

  getStatus(): PddSessionStatusValue { return this.status; }
  getLastError(): string | null { return this.lastError; }
  getActiveConversationId(): string | null { return this.activeConversationId; }
  getBuyerId(): string | null { return this.buyerId; }

  setStatus(next: PddSessionStatusValue, error: string | null = null): void {
    if (!SESSION_STATES.includes(next)) throw new Error("invalid session status: " + next);
    this.status = next;
    if (error !== null) this.lastError = error.slice(0, 200);
  }

  setConversation(conversationId: string, buyerId?: string): void {
    this.activeConversationId = conversationId;
    this.buyerId = buyerId ?? null;
  }

  isReady(): boolean {
    return this.status === "READY";
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
