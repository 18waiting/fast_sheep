// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export interface CountdownDecision {
  remainingTicks: number;
  elapsedTicks: number;
  reachedZero: boolean;
}

export class CountdownPolicy {
  constructor(private readonly defaultTickMs = 1000) {}

  elapse(
    remainingTicks: number,
    elapsedMs: number,
    tickMs: number = this.defaultTickMs,
  ): CountdownDecision {
    if (remainingTicks <= 0) {
      return { remainingTicks: 0, elapsedTicks: 0, reachedZero: true };
    }
    const step = Math.max(1, Math.floor(tickMs));
    const elapsedTicks = Math.floor(elapsedMs / step);
    const next = Math.max(0, remainingTicks - elapsedTicks);
    return { remainingTicks: next, elapsedTicks, reachedZero: next === 0 };
  }
}