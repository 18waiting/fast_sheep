// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { ConversationRuntimeState } from "../state/conversation-runtime-state.js";

export class ManualTakeoverController {
  /**
   * A human takes over the conversation. In-flight AI work is invalidated by
   * advancing the generation token; any pending suggestion is cancelled.
   */
  takeover(state: ConversationRuntimeState): void {
    state.generationToken.next();
    state.aiInflight = false;
    if (state.suggestion && state.suggestion.status === "pending") {
      state.suggestion.status = "cancelled";
    }
    state.countdown.enabled = false;
    state.countdown.remainingTicks = 0;
  }
}