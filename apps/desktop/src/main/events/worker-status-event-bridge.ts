// M6 worker-status event bridge: projects lifecycle changes to the renderer.
import { IPC } from "@fastwork/desktop-ipc";

export interface WorkerEventSink { send(channel: string, payload: unknown): void }
export interface WorkerEventSource { onChange(handler: (status: unknown) => void): () => void }

export class WorkerStatusEventBridge {
  private unsub: (() => void) | null = null;
  constructor(private readonly source: WorkerEventSource, private readonly sink: WorkerEventSink) {}

  start(): void {
    this.unsub = this.source.onChange((status) => this.sink.send(IPC.workerStatusChanged, status));
  }

  stop(): void { this.unsub?.(); this.unsub = null; }
}
