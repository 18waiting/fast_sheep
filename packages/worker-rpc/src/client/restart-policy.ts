// Clean-room implementation (TASK-017 M2). Bounded restart policy (infrastructure only).
import {
  DEFAULT_RESTART_MAX_ATTEMPTS,
  DEFAULT_RESTART_INITIAL_BACKOFF_MS,
  DEFAULT_RESTART_MAX_BACKOFF_MS,
} from "../protocol/constants.js";

export interface RestartPolicyConfig {
  enabled: boolean;
  max_attempts: number;
  initial_backoff_ms: number;
  max_backoff_ms: number;
}

export const DEFAULT_RESTART_POLICY: RestartPolicyConfig = {
  enabled: true,
  max_attempts: DEFAULT_RESTART_MAX_ATTEMPTS,
  initial_backoff_ms: DEFAULT_RESTART_INITIAL_BACKOFF_MS,
  max_backoff_ms: DEFAULT_RESTART_MAX_BACKOFF_MS,
};

/**
 * Tracks restart attempts with exponential backoff (initial * 2^attempt capped at max).
 * reset() is called after a successful ready handshake so a healthy worker starts fresh.
 */
export class RestartPolicy {
  private attempt = 0;

  constructor(private readonly config: RestartPolicyConfig = DEFAULT_RESTART_POLICY) {}

  get attempts(): number {
    return this.attempt;
  }

  reset(): void {
    this.attempt = 0;
  }

  /** Returns the next backoff delay in ms, or null when max_attempts are exhausted. */
  nextDelayMs(): number | null {
    if (!this.config.enabled) return null;
    if (this.attempt >= this.config.max_attempts) return null;
    const delay = Math.min(this.config.initial_backoff_ms * 2 ** this.attempt, this.config.max_backoff_ms);
    this.attempt += 1;
    return delay;
  }

  canRetry(): boolean {
    return this.config.enabled && this.attempt < this.config.max_attempts;
  }
}
