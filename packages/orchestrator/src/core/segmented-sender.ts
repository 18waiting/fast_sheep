// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { Clock } from "../ports/clock.js";
import type { SendAttempt } from "../ports/platform-adapter.js";
import { SegmentedSendPolicy } from "../policies/segmented-send-policy.js";

export type SendTextFn = (shopId: string, conversationId: string, segments: string[]) => Promise<SendAttempt>;
export type ScheduleFn = (delayMs: number, fn: () => void) => () => void;

export interface SegmentedSenderOptions {
  clock: Clock;
  policy?: SegmentedSendPolicy;
  sendText: SendTextFn;
  schedule?: ScheduleFn;
}

const defaultSchedule: ScheduleFn = (delayMs, fn) => {
  const timer = setTimeout(fn, delayMs);
  return () => clearTimeout(timer);
};

export class SegmentedSender {
  private readonly policy: SegmentedSendPolicy;
  private readonly schedule: ScheduleFn;

  constructor(private readonly options: SegmentedSenderOptions) {
    this.policy = options.policy ?? new SegmentedSendPolicy();
    this.schedule = options.schedule ?? defaultSchedule;
  }

  async send(
    shopId: string,
    conversationId: string,
    reply: string,
    intervalMs: number,
  ): Promise<SendAttempt> {
    const parts = this.policy.split(reply, intervalMs);
    if (parts.length === 0) {
      return { ok: true };
    }

    if (intervalMs <= 0) {
      for (const part of parts) {
        const attempt = await this.options.sendText(shopId, conversationId, [part.text]);
        if (!attempt.ok) {
          return attempt;
        }
      }
      return { ok: true };
    }

    return await this.sendScheduled(shopId, conversationId, parts);
  }

  private async sendScheduled(
    shopId: string,
    conversationId: string,
    parts: { text: string; virtualTimeMs: number }[],
  ): Promise<SendAttempt> {
    return await new Promise<SendAttempt>((resolve) => {
      let remaining = parts.length;
      let failed: SendAttempt | null = null;
      const cancels: (() => void)[] = [];

      const finishIfNeeded = (): void => {
        if (remaining === 0) {
          if (failed) {
            resolve(failed);
          } else {
            resolve({ ok: true });
          }
        }
      };

      for (const part of parts) {
        const cancel = this.schedule(part.virtualTimeMs, () => {
          if (failed) {
            return;
          }
          this.options
            .sendText(shopId, conversationId, [part.text])
            .then((attempt) => {
              if (!attempt.ok && !failed) {
                failed = attempt;
              }
              remaining -= 1;
              finishIfNeeded();
            })
            .catch((error: unknown) => {
              if (!failed) {
                failed = { ok: false, error };
              }
              remaining -= 1;
              finishIfNeeded();
            });
        });
        cancels.push(cancel);
      }

      // Guard against a scheduler that never runs zero-delay tasks.
      if (parts.length > 0 && parts.every((part) => part.virtualTimeMs === 0)) {
        cancels.splice(0);
        void Promise.resolve().then(() => {
          for (const part of parts) {
            this.options
              .sendText(shopId, conversationId, [part.text])
              .then((attempt) => {
                if (!attempt.ok && !failed) {
                  failed = attempt;
                }
                remaining -= 1;
                finishIfNeeded();
              })
              .catch((error: unknown) => {
                if (!failed) {
                  failed = { ok: false, error };
                }
                remaining -= 1;
                finishIfNeeded();
              });
          }
        });
      }
    });
  }
}