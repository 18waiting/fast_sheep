// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type {
  AiEngineClient,
  GenerateReplyInput,
  GenerateReplyResult,
  TransferDecision,
} from "../ports/ai-engine-client.js";

export interface WorkerGenerateReplyResponse {
  reply?: string;
  fast_return?: boolean;
  decision?: TransferDecision;
  error?: unknown;
  [key: string]: unknown;
}

export interface WorkerLike {
  generateReply(request: Record<string, unknown>): Promise<WorkerGenerateReplyResponse>;
}

/**
 * Adapts a Python worker's generateReply response to the Main-side AiEngineClient port.
 * The worker owns RAG/Prompt/Provider/Tool execution; this adapter only transports
 * the result across the process boundary.
 */
export class WorkerAiEngineClient implements AiEngineClient {
  constructor(private readonly worker: WorkerLike) {}

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    const response = await this.worker.generateReply({ ...input });
    return {
      reply: response.reply,
      fast_return: response.fast_return,
      decision: response.decision,
      error: response.error,
    };
  }
}