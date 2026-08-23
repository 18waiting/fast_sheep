// M5 test fake: scripted AI engine client (no RPC).
export interface GenerateReplyResultLike {
  reply?: string;
  fast_return?: boolean;
  decision?: unknown;
  generation?: number;
  error?: { category?: string; retryable?: boolean; code?: string };
}

export class FakeAiEngineClient {
  private script: GenerateReplyResultLike[] = [];
  calls: Array<{ input: unknown; result: GenerateReplyResultLike }> = [];
  private index = 0;

  constructor(script: GenerateReplyResultLike[] = []) { this.script = script; }
  setScript(script: GenerateReplyResultLike[]): void { this.script = script; this.index = 0; }
  async generateReply(input: unknown): Promise<GenerateReplyResultLike> {
    const result = this.script[Math.min(this.index, Math.max(0, this.script.length - 1))] ?? { reply: "" };
    this.index += 1;
    this.calls.push({ input, result });
    return result;
  }
  get callCount(): number { return this.calls.length; }
}
