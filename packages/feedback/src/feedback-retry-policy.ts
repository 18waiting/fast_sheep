// M9 feedback retry policy (clean-room). Bounded, no infinite loop.
export class FeedbackRetryPolicy {
  constructor(private readonly maxAttempts = 3) {}

  shouldRetry(attempt: number, lastError: string | undefined): boolean {
    if (attempt >= this.maxAttempts) return false;
    if (!lastError) return false;
    return !lastError.includes("FAILED_FINAL");
  }

  nextDelayMs(attempt: number): number {
    return Math.min(200 * Math.pow(2, attempt), 2000);
  }
}
