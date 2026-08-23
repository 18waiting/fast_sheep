// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// Generic platform port: no real DOM/platform integration lives in this package.

import type { TransferDecision } from "./ai-engine-client.js";

export interface SendAttempt {
  ok: boolean;
  messageId?: string;
  error?: unknown;
}

export interface CurrentConversationState {
  lastMessageId?: string;
  hasNewMessage?: boolean;
  [key: string]: unknown;
}

export interface PlatformAdapter {
  sendText(shopId: string, conversationId: string, segments: string[]): Promise<SendAttempt>;
  getCurrentConversationState?(shopId: string, conversationId: string): Promise<CurrentConversationState>;
  onTransfer?(decision: TransferDecision): void;
}