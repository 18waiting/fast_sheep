// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import { CountdownPolicy } from "../policies/countdown-policy.js";
import type { ConversationRuntimeState } from "../state/conversation-runtime-state.js";

export class CountdownController {
  private readonly policy: CountdownPolicy;

  constructor(private readonly defaultTickMs = 1000) {
    this.policy = new CountdownPolicy(defaultTickMs);
  }

  start(state: ConversationRuntimeState, remainingTicks: number, tickMs = this.defaultTickMs): void {
    state.countdown.enabled = true;
    state.countdown.remainingTicks = remainingTicks;
    state.countdown.tickMs = tickMs;
  }

  cancel(state: ConversationRuntimeState): void {
    state.countdown.enabled = false;
    state.countdown.remainingTicks = 0;
  }

  elapse(state: ConversationRuntimeState, elapsedMs: number): { reachedZero: boolean; remainingTicks: number } {
    if (!state.countdown.enabled) {
      return { reachedZero: false, remainingTicks: state.countdown.remainingTicks };
    }
    const result = this.policy.elapse(
      state.countdown.remainingTicks,
      elapsedMs,
      state.countdown.tickMs,
    );
    state.countdown.remainingTicks = result.remainingTicks;
    if (result.reachedZero) {
      state.countdown.enabled = false;
    }
    return { reachedZero: result.reachedZero, remainingTicks: result.remainingTicks };
  }
}