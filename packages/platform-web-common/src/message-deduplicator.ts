// M8 bounded message deduplicator (platform-neutral).
export interface DedupStats {
  size: number;
  maxSize: number;
}

export class MessageDeduplicator {
  private readonly seen = new Map<string, number>();
  private seq = 0;
  constructor(private readonly maxSize = 512) {}

  isDuplicate(key: string): boolean {
    return this.seen.has(key);
  }

  record(key: string): void {
    this.seen.set(key, this.seq++);
    if (this.seen.size > this.maxSize) {
      let oldestKey: string | null = null;
      let oldestSeq = Infinity;
      for (const [k, s] of this.seen) {
        if (s < oldestSeq) { oldestSeq = s; oldestKey = k; }
      }
      if (oldestKey !== null) this.seen.delete(oldestKey);
    }
  }

  observe(key: string): boolean {
    if (this.isDuplicate(key)) return false;
    this.record(key);
    return true;
  }

  stats(): DedupStats {
    return { size: this.seen.size, maxSize: this.maxSize };
  }
}
