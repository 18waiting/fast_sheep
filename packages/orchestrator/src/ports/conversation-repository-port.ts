// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export type ConversationTurnRole = "buyer" | "ai" | "human";

export interface ConversationTurn {
  shopId: string;
  conversationId: string;
  role: ConversationTurnRole;
  content: string;
  messageId?: string;
  generation?: number;
  [key: string]: unknown;
}

export interface ConversationRepositoryPort {
  appendTurn(turn: ConversationTurn): Promise<void>;
}