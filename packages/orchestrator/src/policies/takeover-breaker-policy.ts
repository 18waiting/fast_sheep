// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { Clock } from "../ports/clock.js";

export type TakeoverBreakerDecision =
  | "no_takeover"
  | "takeover_breaker_triggered"
  | "window_exact"
  | "window_exceeded";

/**
 * Consecutive-reply takeover breaker.
 *
 * threshold: takeover triggers when `consecutiveReplies >= threshold`.
 * windowMs: replies must land inside this window. The boundary at exactly
 * `windowMs` is inclusive (BRK-003 triggered=true); beyond it resets (BRK-004
 * triggered=false).
 */
export class TakeoverBreakerPolicy {
  private consecutiveReplies = 0;
  private firstReplyAt: number | undefined;

  constructor(
    private readonly threshold = 2,
    private readonly windowMs = 60000,
    private readonly clock: Clock = { now: () => 0 },
  ) {}

  recordReply(now = this.clock.now()): void {
    if (this.firstReplyAt !== undefined && now - this.firstReplyAt > this.windowMs) {
      this.consecutiveReplies = 0;
      this.firstReplyAt = now;
    }
    if (this.consecutiveReplies === 0) {
      this.firstReplyAt = now;
    }
    this.consecutiveReplies += 1;
  }

  decide(now = this.clock.now()): TakeoverBreakerDecision {
    if (this.consecutiveReplies < this.threshold) {
      return "no_takeover";
    }

    const first = this.firstReplyAt ?? now;
    const elapsed = now - first;

    if (elapsed > this.windowMs) {
      this.reset();
      return "window_exceeded";
    }

    if (elapsed === this.windowMs) {
      return "window_exact";
    }

    return "takeover_breaker_triggered";
  }

  reset(): void {
    this.consecutiveReplies = 0;
    this.firstReplyAt = undefined;
  }
}