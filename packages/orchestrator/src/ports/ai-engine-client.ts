// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M5: AI engine client port. The orchestrator consumes generated replies but never
// performs RAG/Prompt/Provider/Tool work; those are Python-side concerns.

export interface TransferDecision {
  requested: boolean;
  target?: string;
  reason?: string;
  buyer_message?: string;
  [key: string]: unknown;
}

export interface GenerateReplyInput {
  shopId: string;
  conversationId: string;
  message: string;
  generation: number;
  [key: string]: unknown;
}

export interface GenerateReplyResult {
  reply?: string;
  fast_return?: boolean;
  decision?: TransferDecision;
  error?: unknown;
}

/** Result shape accepted by ConversationOrchestrator.onAiResult. */
export interface AiEngineResult extends GenerateReplyResult {
  generation?: number;
}

export interface AiEngineClient {
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult>;
}