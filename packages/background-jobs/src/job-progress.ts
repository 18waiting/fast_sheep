// M10 job progress (clean-room): monotonic only.
export class JobProgress {
  private value = 0;
  report(next: number): number {
    if (!Number.isFinite(next)) return this.value;
    this.value = Math.max(this.value, Math.min(100, next));
    return this.value;
  }
  get(): number { return this.value; }
}
