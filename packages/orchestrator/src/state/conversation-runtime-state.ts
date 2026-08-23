// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import { GenerationToken } from "./generation-token.js";
import type { SuggestionState } from "./suggestion-state.js";

export interface CountdownRuntimeState {
  enabled: boolean;
  remainingTicks: number;
  tickMs: number;
}

export interface BreakerRuntimeState {
  consecutiveReplies: number;
  firstReplyAt: number;
}

export interface SendRequest {
  shopId: string;
  conversationId: string;
  reply: string;
  generation: number;
  mode: "human_review" | "full_auto";
  [key: string]: unknown;
}

export interface ConversationRuntimeState {
  shopId: string;
  conversationId: string;
  mode: "human_review" | "full_auto";
  generationToken: GenerationToken;
  suggestion: SuggestionState | null;
  countdown: CountdownRuntimeState;
  sending: boolean;
  sendQueue: SendRequest[];
  breaker: BreakerRuntimeState;
  aiInflight: boolean;
  lastMessageId?: string;
  [key: string]: unknown;
}

export function createConversationRuntimeState(
  shopId: string,
  conversationId: string,
): ConversationRuntimeState {
  return {
    shopId,
    conversationId,
    mode: "human_review",
    generationToken: new GenerationToken(),
    suggestion: null,
    countdown: { enabled: false, remainingTicks: 0, tickMs: 1000 },
    sending: false,
    sendQueue: [],
    breaker: { consecutiveReplies: 0, firstReplyAt: 0 },
    aiInflight: false,
    lastMessageId: undefined,
  };
}