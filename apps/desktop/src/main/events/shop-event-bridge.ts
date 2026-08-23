// M6 shop event bridge: notifies the renderer that shop data changed.
import { IPC } from "@fastwork/desktop-ipc";

export interface ShopEventSink { send(channel: string, payload?: unknown): void }
export interface ShopEventSource { onChange(handler: () => void): () => void }

export class ShopEventBridge {
  private unsub: (() => void) | null = null;
  constructor(private readonly source: ShopEventSource, private readonly sink: ShopEventSink) {}

  start(): void { this.unsub = this.source.onChange(() => this.sink.send(IPC.shopsChanged)); }
  stop(): void { this.unsub?.(); this.unsub = null; }
}
