// M8 bounded automated-send acknowledgement registry (platform-neutral).
// Prevents adapter-generated sends from being misclassified as human takeover.
import type { AutomatedSendAck } from "./types.js";

export class SendAckRegistry {
  private readonly acks = new Map<string, number>();
  constructor(private readonly maxSize = 128, private readonly expiryMs = 60_000) {}

  record(messageId: string, atMs: number): void {
    this.acks.set(messageId, atMs);
    if (this.acks.size > this.maxSize) {
      const oldest = this.acks.keys().next().value;
      if (oldest !== undefined) this.acks.delete(oldest);
    }
  }

  containsWithin(messageId: string, nowMs: number): boolean {
    const at = this.acks.get(messageId);
    return at !== undefined && nowMs - at <= this.expiryMs;
  }

  recent(nowMs: number): AutomatedSendAck[] {
    const out: AutomatedSendAck[] = [];
    for (const [message_id, at_ms] of this.acks) {
      if (nowMs - at_ms <= this.expiryMs) out.push({ message_id, at_ms });
    }
    return out;
  }
}
