// M6 orchestrator event bridge: state/events only; no business mutation.
import { IPC, type OrchestratorEventPayload } from "@fastwork/desktop-ipc";

export interface EventSink {
  send(channel: string, payload: unknown): void;
}

export interface EventSource {
  on(event: string, handler: (payload: unknown) => void): () => void;
}

export class OrchestratorEventBridge {
  private unsubs: Array<() => void> = [];

  constructor(private readonly source: EventSource, private readonly sink: EventSink, private readonly revision: () => number) {}

  start(): void {
    this.unsubs.push(this.source.on("SuggestionReady", () => this.emit("SuggestionReady")));
    this.unsubs.push(this.source.on("SendStarted", () => this.emit("SendStarted")));
    this.unsubs.push(this.source.on("SendCompleted", () => this.emit("SendCompleted")));
    this.unsubs.push(this.source.on("SendFailed", () => this.emit("SendFailed")));
    this.unsubs.push(this.source.on("HumanTakeover", () => this.emit("HumanTakeover")));
  }

  private emit(event: string): void {
    const payload: OrchestratorEventPayload = { event, revision: this.revision() };
    this.sink.send(IPC.orchestratorEvent, payload);
  }

  stop(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
