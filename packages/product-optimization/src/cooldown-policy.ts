// M10 cooldown policy (clean-room): 3600s gte boundary; stale >86400 purge.
export class CooldownPolicy {
  constructor(private readonly cooldownSeconds = 3600, private readonly purgeSeconds = 86400) {}
  isCoolingDown(lastOptimizedAt: string | null | undefined, nowMs: number): { cooldown: boolean; operator?: "gte"; purge?: boolean } {
    if (!lastOptimizedAt) return { cooldown: false };
    const last = Date.parse(lastOptimizedAt);
    if (Number.isNaN(last)) return { cooldown: false };
    const elapsed = (nowMs - last) / 1000;
    if (elapsed > this.purgeSeconds) return { cooldown: false, purge: true };
    if (elapsed >= this.cooldownSeconds) return { cooldown: false, operator: "gte" };
    return { cooldown: true };
  }
}
