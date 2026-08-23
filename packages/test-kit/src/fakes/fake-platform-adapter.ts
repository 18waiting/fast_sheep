// M5 test fake: generic platform adapter (no DOM).
export interface SendAttemptLike { ok: boolean; error?: string; sent_segments?: number; virtual_time_ms?: number[] }

export class FakePlatformAdapter {
  sendCalls: Array<{ shopId: string; conversationId: string; segments: string[]; virtualTimeMs: number }> = [];
  sendError = false;
  newMessageAfterSuggestion = false;
  transferCalls: Array<{ decision: unknown }> = [];
  private clock: { now(): number } | null;

  constructor(clock: { now(): number } | null = null) { this.clock = clock; }
  async sendText(shopId: string, conversationId: string, segments: string[]): Promise<SendAttemptLike> {
    this.sendCalls.push({ shopId, conversationId, segments, virtualTimeMs: this.clock ? this.clock.now() : 0 });
    if (this.sendError) return { ok: false, error: "send_failed", sent_segments: 0 };
    return { ok: true, sent_segments: segments.length };
  }
  async getCurrentConversationState(_shopId: string, _conversationId: string): Promise<{ hasNewMessage: boolean }> {
    return { hasNewMessage: this.newMessageAfterSuggestion };
  }
  onTransfer(decision: unknown): void { this.transferCalls.push({ decision }); }
  get sendCallCount(): number { return this.sendCalls.length; }
}
