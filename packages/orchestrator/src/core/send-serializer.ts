// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { SendRequest } from "../state/conversation-runtime-state.js";

export type SendSerializerStatus = "started" | "serialized_wait";

export class SendSerializer {
  private readonly sending = new Set<string>();
  private readonly queues = new Map<string, SendRequest[]>();

  key(shopId: string, conversationId: string): string {
    return `${shopId}\u0000${conversationId}`;
  }

  enqueue(key: string, request: SendRequest): SendSerializerStatus {
    const queue = this.queues.get(key) ?? [];
    queue.push(request);
    this.queues.set(key, queue);

    if (this.sending.has(key)) {
      return "serialized_wait";
    }
    this.sending.add(key);
    return "started";
  }

  /** Returns the next queued request, or null when the queue is empty. */
  dequeue(key: string): SendRequest | null {
    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) {
      this.sending.delete(key);
      return null;
    }
    const request = queue.shift();
    if (!request) {
      this.sending.delete(key);
      return null;
    }
    this.sending.add(key);
    return request;
  }

  markDone(key: string): void {
    this.sending.delete(key);
  }

  isSending(key: string): boolean {
    return this.sending.has(key);
  }

  queueSize(key: string): number {
    return this.queues.get(key)?.length ?? 0;
  }

  queue(key: string): SendRequest[] {
    return [...(this.queues.get(key) ?? [])];
  }

  setSending(key: string, value: boolean): void {
    if (value) {
      this.sending.add(key);
    } else {
      this.sending.delete(key);
    }
  }

  seedQueue(key: string, requests: SendRequest[]): void {
    this.queues.set(key, [...requests]);
  }
}