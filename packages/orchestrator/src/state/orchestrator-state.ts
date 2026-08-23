// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { SuggestionState } from "./suggestion-state.js";

export interface DecisionRecord {
  decision: string;
  [key: string]: unknown;
}

export interface ConversationSnapshot {
  shopId: string;
  conversationId: string;
  mode: "human_review" | "full_auto";
  generation: number;
  suggestion: SuggestionState | null;
  countdown: { enabled: boolean; remainingTicks: number; tickMs: number };
  sending: boolean;
  sendQueue: unknown[];
  aiInflight: boolean;
  breaker: { consecutiveReplies: number; firstReplyAt: number };
  lastMessageId?: string;
}

export interface OrchestratorSnapshot {
  focusedShopId: string | null;
  decisions: DecisionRecord[];
  conversations: ConversationSnapshot[];
}