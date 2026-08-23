// M5 test fake: captured event bus.
export interface CapturedEvent { event: string; payload?: Record<string, unknown> }

export class CapturingEventBus {
  captured: CapturedEvent[] = [];
  private handlers: Array<(e: CapturedEvent) => void> = [];
  emit(event: string, payload?: Record<string, unknown>): void {
    const e = { event, payload };
    this.captured.push(e);
    for (const h of [...this.handlers]) { try { h(e); } catch { /* isolate */ } }
  }
  on(handler: (e: CapturedEvent) => void): () => void { this.handlers.push(handler); return () => { this.handlers = this.handlers.filter((h) => h !== handler); }; }
  events(): string[] { return this.captured.map((c) => c.event); }
}
