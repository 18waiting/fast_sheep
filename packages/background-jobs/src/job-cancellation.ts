// M10 cooperative cancellation (clean-room).
export class JobCancellation {
  cancelled = false;
  token: string | null = null;
  constructor(token?: string) { this.token = token ?? null; }
  cancel(): void { this.cancelled = true; }
  check(): void {
    if (this.cancelled) throw new Error("job.cancelled");
  }
  isCancelled(): boolean { return this.cancelled; }
}
