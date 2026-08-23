// M5 test fake: records virtual-time send segments.
export interface RecordedSend { shopId: string; conversationId: string; segment: string; virtualTimeMs: number; index: number }

export class RecordingSendRecorder {
  records: RecordedSend[] = [];
  record(shopId: string, conversationId: string, segment: string, virtualTimeMs: number, index = 0): void {
    this.records.push({ shopId, conversationId, segment, virtualTimeMs, index });
  }
  get count(): number { return this.records.length; }
  clear(): void { this.records = []; }
}
