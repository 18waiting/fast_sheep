// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { Clock } from "../ports/clock.js";
import type { TransferDecision } from "../ports/ai-engine-client.js";
import type { SuggestionState } from "../state/suggestion-state.js";

export class SuggestionManager {
  constructor(private readonly clock: Clock) {}

  create(
    reply: string,
    generation: number,
    mode: "human_review" | "full_auto",
    decision?: TransferDecision,
  ): SuggestionState {
    return {
      reply,
      generation,
      createdAt: this.clock.now(),
      mode,
      status: "pending",
      decision,
    };
  }

  markSent(suggestion: SuggestionState): void {
    suggestion.status = "sent";
  }

  cancel(suggestion: SuggestionState): void {
    suggestion.status = "cancelled";
  }

  invalidate(suggestion: SuggestionState | null): void {
    if (suggestion && suggestion.status === "pending") {
      suggestion.status = "cancelled";
    }
  }
}