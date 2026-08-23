// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { AiEngineClient } from "../ports/ai-engine-client.js";
import type { Clock } from "../ports/clock.js";
import { PreSendRevalidationPolicy } from "../policies/pre-send-revalidation-policy.js";
import type { ConversationRuntimeState } from "../state/conversation-runtime-state.js";
import { SuggestionManager } from "./suggestion-manager.js";

export interface PreSendRevalidationResult {
  regenerated: boolean;
  generation: number;
}

export class PreSendController {
  private readonly policy: PreSendRevalidationPolicy;
  private readonly suggestionManager: SuggestionManager;

  constructor(
    private readonly aiEngineClient: AiEngineClient,
    clock: Clock,
    policy?: PreSendRevalidationPolicy,
  ) {
    this.policy = policy ?? new PreSendRevalidationPolicy();
    this.suggestionManager = new SuggestionManager(clock);
  }

  async revalidate(
    state: ConversationRuntimeState,
    shopId: string,
    conversationId: string,
  ): Promise<PreSendRevalidationResult> {
    const generation = state.generationToken.next();
    const result = await this.aiEngineClient.generateReply({
      shopId,
      conversationId,
      message: state.lastMessageId ?? "",
      generation,
    });

    if (typeof result.reply === "string" && result.reply.length > 0) {
      state.suggestion = this.suggestionManager.create(
        result.reply,
        generation,
        state.mode,
        result.decision,
      );
      return { regenerated: true, generation };
    }

    return { regenerated: false, generation: state.generationToken.current() };
  }
}